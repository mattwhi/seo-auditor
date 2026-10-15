<?php
/**
 * Plugin Name: SEO Auditor Metadata Bridge
 * Description: Narrow, authenticated Rank Math metadata read and compare-and-swap updates for SEO Auditor.
 * Version: 0.8.5
 * Requires PHP: 8.0
 */
if (!defined('ABSPATH')) { exit; }
// Write permission is controlled by a WordPress administrator, not by editing wp-config.php.
// Existing constant-based installations remain supported during migration.
function seo_auditor_bridge_writes_enabled() {
    return get_option('seo_auditor_bridge_writes_enabled', '0') === '1'
        || (defined('SEO_AUDITOR_BRIDGE_WRITES_ENABLED') && SEO_AUDITOR_BRIDGE_WRITES_ENABLED === true);
}
add_action('admin_menu', static function () {
    add_options_page('SEO Auditor Bridge', 'SEO Auditor Bridge', 'manage_options', 'seo-auditor-bridge', 'seo_auditor_bridge_settings_page');
});
function seo_auditor_bridge_settings_page() {
    if (!current_user_can('manage_options')) { wp_die('Not authorised'); }
    if (isset($_POST['seo_auditor_save'])) {
        check_admin_referer('seo_auditor_bridge_save');
        update_option('seo_auditor_bridge_writes_enabled', isset($_POST['seo_auditor_allow_writes']) ? '1' : '0', false);
        echo '<div class="notice notice-success"><p>SEO Auditor bridge settings saved.</p></div>';
    }
    $enabled = seo_auditor_bridge_writes_enabled();
    echo '<div class="wrap"><h1>SEO Auditor Metadata Bridge</h1>';
    echo '<p>Authenticated reads are enabled. Writes require a WordPress administrator account, SEO Auditor project approval and a matching preflight snapshot.</p>';
    echo '<form method="post">';
    wp_nonce_field('seo_auditor_bridge_save');
    echo '<label><input type="checkbox" name="seo_auditor_allow_writes" value="1" '.checked($enabled, true, false).'> Allow approved Rank Math title and description writes</label>';
    echo '<p class="description">This permits live changes from authenticated administrators. Keep disabled until you are ready to test.</p>';
    if (defined('SEO_AUDITOR_BRIDGE_WRITES_ENABLED') && SEO_AUDITOR_BRIDGE_WRITES_ENABLED === true) {
        echo '<p><strong>Note:</strong> Legacy wp-config.php constant currently enables writes independently of this checkbox.</p>';
    }
    echo '<p><button type="submit" name="seo_auditor_save" value="1" class="button button-primary">Save changes</button></p></form></div>';
}

add_action('rest_api_init', static function () {
    $namespace = 'seo-auditor/v1';
    $permission = static function ($request) {
        $type = $request['type'];
        $id = absint($request['id']);
        $post = get_post($id);
        $types = ['posts' => 'post', 'pages' => 'page', 'product' => 'product'];
        if (!$post || !isset($types[$type]) || $post->post_type !== $types[$type]) {
            return new WP_Error('target_not_found', 'Invalid target', ['status' => 404]);
        }
        if (!current_user_can('edit_post', $id)) {
            return new WP_Error('forbidden', 'Not authorised to edit this object', ['status' => 403]);
        }
        return true;
    };
    $snapshot = static function ($request) {
        $id = absint($request['id']);
        $field = $request->get_param('field');
        if (!in_array($field, ['rank_math_title', 'rank_math_description'], true)) {
            return new WP_Error('invalid_field', 'Unsupported field', ['status' => 400]);
        }
        if (!defined('RANK_MATH_VERSION')) {
            return new WP_Error('rank_math_unavailable', 'Rank Math is not active', ['status' => 409]);
        }
        $value = get_post_meta($id, $field, true);
        if (!is_string($value)) {
            return new WP_Error('invalid_metadata', 'Metadata must be text', ['status' => 409]);
        }
        return ['type' => $request['type'], 'id' => $id, 'field' => $field, 'value' => $value, 'adapter' => 'rank_math_bridge_v1'];
    };
    register_rest_route($namespace, '/meta/(?P<type>posts|pages|product)/(?P<id>[1-9][0-9]*)', [
        [ 'methods' => WP_REST_Server::READABLE, 'permission_callback' => $permission,
          'args' => ['field' => ['required' => true, 'type' => 'string']], 'callback' => $snapshot ],
        [ 'methods' => WP_REST_Server::CREATABLE,
          'permission_callback' => static function ($request) use ($permission) {
              $allowed = $permission($request);
              if (is_wp_error($allowed)) { return $allowed; }
              if (!current_user_can('manage_options') || !seo_auditor_bridge_writes_enabled()) {
                  return new WP_Error('writes_disabled', 'Bridge writes disabled', ['status' => 403]);
              }
              return true;
          },
          'args' => [
              'field' => ['required' => true, 'type' => 'string'],
              'expectedValue' => ['required' => true, 'type' => 'string'],
              'newValue' => ['required' => true, 'type' => 'string'],
          ],
          'callback' => static function ($request) use ($snapshot) {
              $before = $snapshot($request);
              if (is_wp_error($before)) { return $before; }
              $expected = $request->get_param('expectedValue');
              $new = $request->get_param('newValue');
              if (!is_string($expected) || !is_string($new) || strlen($new) > 2000) {
                  return new WP_Error('invalid_value', 'Invalid metadata value', ['status' => 400]);
              }
              if (!hash_equals($before['value'], $expected)) {
                  return new WP_Error('metadata_conflict', 'Metadata changed since preflight', ['status' => 409]);
              }
              if ($expected !== $new) {
                  $id = absint($request['id']);
                  $field = $request->get_param('field');
                  // Existing meta is replaced only if the exact previous value matches.
                  // An absent key must be handled explicitly rather than overwriting it blindly.
                  if (metadata_exists('post', $id, $field)) {
                      $changed = update_post_meta($id, $field, wp_slash($new), $expected);
                  } else {
                      if ($expected !== '') { return new WP_Error('metadata_conflict', 'Metadata was removed', ['status' => 409]); }
                      $changed = add_post_meta($id, $field, wp_slash($new), true);
                  }
                  if (!$changed) { return new WP_Error('metadata_write_failed', 'Update not confirmed', ['status' => 409]); }
              }
              $after = $snapshot($request);
              if (is_wp_error($after) || $after['value'] !== $new) {
                  return new WP_Error('metadata_verification_failed', 'Read-back verification failed', ['status' => 502]);
              }
              return ['verified' => true, 'type' => $request['type'], 'id' => absint($request['id']),
                  'field' => $request->get_param('field'), 'value' => $after['value']];
          },
        ],
    ]);
});
