"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
import { Brand } from "@/components/dashboard/Shell";
import { api } from "@/lib/operations";
export default function Login() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [pending, setPending] = useState(false);
    const [error, setError] = useState("");
    const submit = async (e: FormEvent) => { e.preventDefault(); setPending(true); setError(""); try {
        const res = await api<{ ok: boolean; token?: string; user?: any }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
        if (typeof window !== "undefined" && res?.token) {
            localStorage.setItem("argus-token", res.token);
        }
        router.replace("/overview");
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        setPending(false);
    } };
    return <main className="login-screen"><section className="login-story"><Brand /><div><span className="eyebrow">FACTORY OPERATIONS</span><h1>A clearer view.<br />A faster response.</h1><p>Your cameras, evidence and incident workflow in one focused safety workspace.</p><div className="login-feature"><ShieldCheck /><span>Local detection. Supervisor-led response.</span></div></div><small>ARGUS AI · Factory safety intelligence</small></section><section className="login-form-wrap"><form onSubmit={submit} className="login-form"><div className="login-lock"><LockKeyhole size={25}/></div><h2>Welcome back</h2><p className="muted">Sign in to your factory safety workspace.</p><label>Email address<input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@factory.ai"/></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Enter your password"/></label>{error && <div className="error-box" role="alert">{error}</div>}<button className="button primary wide" disabled={pending}>{pending ? "Signing in…" : "Sign in"}<ArrowRight size={17}/></button><p className="login-help">Use the account provided by your factory administrator.</p></form></section></main>;
}
