import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Eye, EyeOff, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { signUp } from '../services/auth';

export default function RegisterPage() {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const [errors, setErrors] = useState<{
    fullName?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const validate = () => {
    const newErrors: typeof errors = {};

    if (!fullName.trim()) {
      newErrors.fullName = 'El nombre es obligatorio';
    }

    if (!email.trim()) {
      newErrors.email = 'El email es obligatorio';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Ingresá un email válido';
    }

    if (!password) {
      newErrors.password = 'La contraseña es obligatoria';
    } else if (password.length < 6) {
      newErrors.password = 'Mínimo 6 caracteres';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Confirmá tu contraseña';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Las contraseñas no coinciden';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setLoading(true);

    try {
      const { error } = await signUp(email, password, fullName.trim());

      if (error) {
        toast.error(error.message);
        return;
      }

      setShowSuccess(true);
    } catch {
      toast.error('Error al crear la cuenta');
    } finally {
      setLoading(false);
    }
  };

  if (showSuccess) {
    return (
      <div className="text-center py-4">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/15 mx-auto mb-3">
          <CheckCircle size={24} className="text-emerald-400" />
        </div>
        <h2 className="text-lg font-semibold text-white mb-1">Revisá tu email</h2>
        <p className="text-sm text-[#9CA3AF] mb-4">
          Te enviamos un enlace a <span className="text-white font-medium">{email}</span>
        </p>
        <Link
          to="/login"
          className="text-sm text-[#DC2626] hover:text-[#EF4444] font-medium transition-colors"
        >
          Volver al login
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">Crear cuenta</h2>

      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          label="Nombre completo"
          icon={User}
          placeholder="Tu nombre"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          error={errors.fullName}
          autoComplete="name"
        />

        <Input
          label="Email"
          type="email"
          icon={Mail}
          placeholder="tu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          autoComplete="email"
        />

        <div className="relative">
          <Input
            label="Contraseña"
            type={showPassword ? 'text' : 'password'}
            icon={Lock}
            placeholder="Mínimo 6 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-[38px] text-[#9CA3AF] hover:text-white transition-colors"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        <Input
          label="Confirmar contraseña"
          type="password"
          icon={Lock}
          placeholder="Repetí tu contraseña"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={errors.confirmPassword}
          autoComplete="new-password"
        />

        <Button
          type="submit"
          loading={loading}
          className="w-full"
        >
          Crear cuenta
        </Button>
      </form>

      <p className="text-center mt-4 text-sm text-[#9CA3AF]">
        ¿Ya tenés cuenta?{' '}
        <Link
          to="/login"
          className="text-[#DC2626] hover:text-[#EF4444] font-medium transition-colors"
        >
          Iniciá sesión
        </Link>
      </p>
    </div>
  );
}
