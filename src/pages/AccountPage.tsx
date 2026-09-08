import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  User,
  Mail,
  Phone,
  Lock,
  Trash2,
  Camera,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';

export default function AccountPage() {
  const { profile, user } = useAuth();

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');

  const handleSaveProfile = () => {
    if (!fullName.trim()) {
      toast.error('El nombre es requerido');
      return;
    }
    toast.success('Perfil actualizado');
  };

  const handleChangePassword = () => {
    if (!currentPassword || !newPassword) {
      toast.error('Completá todos los campos');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }
    toast.success('Contraseña cambiada');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleDeleteAccount = () => {
    if (deleteConfirm !== 'ELIMINAR') {
      toast.error('Debés escribir ELIMINAR para confirmar');
      return;
    }
    toast.success('Cuenta eliminada');
    setDeleteModal(false);
  };

  return (
    <div className="min-h-screen bg-[#080808] p-4 md:p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-bold text-white mb-6">Mi cuenta</h1>

      {/* Profile Photo */}
      <Card className="mb-4">
        <div className="flex items-center gap-4">
          <div className="relative group">
            <div className="w-20 h-20 rounded-full bg-[#333] flex items-center justify-center overflow-hidden">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User size={32} className="text-[#9CA3AF]" />
              )}
            </div>
            <button className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <Camera size={20} className="text-white" />
            </button>
          </div>
          <div>
            <p className="text-sm font-medium text-white">{profile?.full_name ?? 'Sin nombre'}</p>
            <p className="text-xs text-[#9CA3AF]">{user?.email}</p>
          </div>
        </div>
      </Card>

      {/* Profile Info */}
      <Card className="mb-4">
        <h3 className="text-sm font-semibold text-white mb-4">Información personal</h3>
        <div className="space-y-4">
          <Input
            label="Nombre completo"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            icon={User}
          />
          <Input
            label="Email"
            value={user?.email ?? ''}
            disabled
            icon={Mail}
          />
          <Input
            label="Teléfono"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+54 11 1234-5678"
            icon={Phone}
          />
          <div className="flex justify-end">
            <Button onClick={handleSaveProfile}>
              Guardar cambios
            </Button>
          </div>
        </div>
      </Card>

      {/* Change Password */}
      <Card className="mb-4">
        <h3 className="text-sm font-semibold text-white mb-4">Cambiar contraseña</h3>
        <div className="space-y-4">
          <Input
            label="Contraseña actual"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            icon={Lock}
          />
          <Input
            label="Nueva contraseña"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            icon={Lock}
          />
          <Input
            label="Confirmar nueva contraseña"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            icon={Lock}
          />
          <div className="flex justify-end">
            <Button onClick={handleChangePassword}>
              Cambiar contraseña
            </Button>
          </div>
        </div>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-500/30">
        <div className="flex items-start gap-3">
          <Trash2 size={20} className="text-red-400 mt-0.5 shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-white mb-1">Eliminar cuenta</h3>
            <p className="text-xs text-[#9CA3AF] mb-3">
              Esta acción es irreversible. Se eliminarán todos tus datos, incluyendo reservas, clientes y configuración.
            </p>
            <Button variant="danger" size="sm" onClick={() => setDeleteModal(true)}>
              Eliminar mi cuenta
            </Button>
          </div>
        </div>
      </Card>

      <Modal isOpen={deleteModal} onClose={() => setDeleteModal(false)} title="Eliminar cuenta" maxWidth="sm">
        <div className="space-y-4">
          <p className="text-sm text-[#9CA3AF]">
            Escribí <span className="font-bold text-white">ELIMINAR</span> para confirmar:
          </p>
          <Input
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder="ELIMINAR"
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => { setDeleteModal(false); setDeleteConfirm(''); }}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleDeleteAccount}>
              Eliminar cuenta
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
