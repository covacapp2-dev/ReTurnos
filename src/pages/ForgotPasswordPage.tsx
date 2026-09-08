import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { resetPassword } from '../services/auth';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.error('Ingresá tu email');
      return;
    }

    setLoading(true);

    try {
      const { error } = await resetPassword(email);

      if (error) {
        toast.error(error.message);
        return;
      }

      setSent(true);
    } catch {
      toast.error('Error al enviar el email');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#080808] px-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-[#1A1A1A] border border-[#333] rounded-xl p-8">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/15 mx-auto mb-5">
              <CheckCircle size={32} className="text-emerald-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              Email enviado
            </h2>
            <p className="text-[#9CA3AF] mb-6">
              Te enviamos un enlace para recuperar tu contraseña a <span className="text-white font-medium">{email}</span>. Revisá tu bandeja de entrada.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm text-[#DC2626] hover:text-[#EF4444] font-medium transition-colors"
            >
              <ArrowLeft size={16} />
              Volver al login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#080808] px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">
            Re<span className="text-[#DC2626]">Turnos</span>
          </h1>
        </div>

        <div className="bg-[#1A1A1A] border border-[#333] rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-2">
            Recuperar contraseña
          </h2>
          <p className="text-[#9CA3AF] text-sm mb-6">
            Ingresá tu email y te enviaremos un enlace para restablecer tu contraseña.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              icon={Mail}
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />

            <Button
              type="submit"
              loading={loading}
              className="w-full"
              size="lg"
            >
              Enviar email de recuperación
            </Button>
          </form>
        </div>

        <p className="text-center mt-6">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-sm text-[#9CA3AF] hover:text-white transition-colors"
          >
            <ArrowLeft size={16} />
            Volver al login
          </Link>
        </p>
      </div>
    </div>
  );
}
