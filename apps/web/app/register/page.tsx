'use client';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
export default function Register() {
 const router=useRouter(); const [error,setError]=useState(''); const [loading,setLoading]=useState(false);
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setLoading(true);const form=new FormData(e.currentTarget);const token=new URLSearchParams(window.location.search).get('token');
 try{const r=await fetch('/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,password:form.get('password')})});if(!r.ok){setError('Invitation invalid, expired or already used');return;}router.push('/login');}catch{setError('Registration failed');}finally{setLoading(false);}}
 return <main style={{maxWidth:420,margin:'10vh auto',padding:24}}><h1>Accept your invitation</h1><p>Set a password of at least 12 characters.</p><form onSubmit={submit}><label>New password<input name="password" type="password" autoComplete="new-password" minLength={12} required style={{display:'block',width:'100%',marginBottom:16}}/></label><button disabled={loading}>Create account</button></form>{error && <p role="alert">{error}</p>}</main>;
}
