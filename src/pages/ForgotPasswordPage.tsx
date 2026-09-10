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
      <div className="text-center py-4">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/15 mx-auto mb-3">
          <CheckCircle size={24} className="text-emerald-400" />
        </div>
        <h2 className="text-lg font-semibold text-white mb-1">Email enviado</h2>
        <p className="text-sm text-[#9CA3AF] mb-4">
          Revisá tu bandeja de entrada
        </p>
        <Link
          to="/login"
          className="inline-flex items-center gap-1 text-sm text-[#DC2626] hover:text-[#EF4444] font-medium transition-colors"
        >
          <ArrowLeft size={14} />
          Volver al login
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-1">Recuperar contraseña</h2>
      <p className="text-sm text-[#9CA3AF] mb-4">
        Ingresá tu email y te enviaremos un enlace para restablecer tu contraseña.
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
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
        >
          Enviar email de recuperación
        </Button>
      </form>

      <p className="text-center mt-4">
        <Link
          to="/login"
          className="inline-flex items-center gap-1 text-sm text-[#9CA3AF] hover:text-white transition-colors"
        >
          <ArrowLeft size={14} />
          Volver al login
        </Link>
      </p>
    </div>
  );
}
