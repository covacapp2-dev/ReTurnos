import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ShoppingBag, Plus, Pencil, Trash2, ScanBarcode } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getProducts, createProduct, updateProduct, deleteProduct } from '../services/products';
import type { Product } from '../types';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import SearchInput from '../components/ui/SearchInput';

interface FormData {
  name: string;
  cost: string;
  price: string;
  barcode: string;
  is_active: boolean;
}

const defaultForm: FormData = {
  name: '',
  cost: '',
  price: '',
  barcode: '',
  is_active: true,
};

const toNumber = (value: string): number | null => {
  const clean = value.replace(/\./g, '').replace(',', '.').trim();
  if (clean === '') return 0;
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : null;
};

export default function ProductsPage() {
  const { business } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState<string | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<FormData>(defaultForm);
  const [scanOpen, setScanOpen] = useState(false);
  const scannerRef = useRef<{
    stop: () => Promise<void>;
    clear: () => void;
  } | null>(null);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', business?.id],
    queryFn: () => getProducts(business!.id),
    enabled: !!business?.id,
    select: (res) => res.data ?? [],
  });

  // --- Escáner de código de barras con la cámara ---
  const stopScan = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) return;
    try {
      await scanner.stop();
    } catch {
      /* el elemento ya puede haberse desmontado */
    }
    try {
      scanner.clear();
    } catch {
      /* ignore */
    }
  }, []);

  const startScan = useCallback(async () => {
    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('barcode-scanner-box', {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.QR_CODE,
        ],
        verbose: false,
      });
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 260, height: 140 } },
        (decodedText) => {
          setForm((prev) => ({ ...prev, barcode: decodedText }));
          setScanOpen(false);
          toast.success(`Código leído: ${decodedText}`);
        },
        () => {
          /* sin lectura en este cuadro, se sigue escaneando */
        }
      );
    } catch {
      scannerRef.current = null;
      setScanOpen(false);
      toast.error('No se pudo abrir la cámara. Revisá los permisos del navegador.');
    }
  }, []);

  useEffect(() => {
    if (scanOpen) void startScan();
    else void stopScan();
  }, [scanOpen, startScan, stopScan]);

  useEffect(() => () => void stopScan(), [stopScan]);

  // --- Mutaciones ---
  const createMut = useMutation({
    mutationFn: async (data: FormData) => {
      const cost = toNumber(data.cost);
      const price = toNumber(data.price);
      if (cost === null) throw new Error('El costo no es un número válido');
      if (price === null) throw new Error('El precio no es un número válido');

      const res = await createProduct({
        business_id: business!.id,
        name: data.name.trim(),
        cost,
        price,
        barcode: data.barcode.trim() || null,
        is_active: data.is_active,
      });
      if (res.error) {
        const msg = res.error.message.toLowerCase();
        throw new Error(
          msg.includes('duplicate') || msg.includes('unique')
            ? 'Ya existe un producto con ese código de barras'
            : res.error.message
        );
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', business?.id] });
      toast.success('Producto creado');
      closeModal();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Error al crear producto'),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FormData }) => {
      const cost = toNumber(data.cost);
      const price = toNumber(data.price);
      if (cost === null) throw new Error('El costo no es un número válido');
      if (price === null) throw new Error('El precio no es un número válido');

      const res = await updateProduct(id, {
        name: data.name.trim(),
        cost,
        price,
        barcode: data.barcode.trim() || null,
        is_active: data.is_active,
      });
      if (res.error) {
        const msg = res.error.message.toLowerCase();
        throw new Error(
          msg.includes('duplicate') || msg.includes('unique')
            ? 'Ya existe un producto con ese código de barras'
            : res.error.message
        );
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', business?.id] });
      toast.success('Producto actualizado');
      closeModal();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Error al actualizar producto'),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await deleteProduct(id);
      if (res.error) throw new Error(res.error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', business?.id] });
      toast.success('Producto eliminado');
      setDeleteModal(null);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Error al eliminar producto'),
  });

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditing(null);
    setForm(defaultForm);
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(defaultForm);
    setModalOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      cost: p.cost != null ? String(p.cost) : '',
      price: p.price != null ? String(p.price) : '',
      barcode: p.barcode ?? '',
      is_active: p.is_active,
    });
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('El nombre es requerido');
      return;
    }
    if (editing) {
      updateMut.mutate({ id: editing.id, data: form });
    } else {
      createMut.mutate(form);
    }
  };

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.barcode ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const margin = (p: Product) => {
    if (p.price == null || p.cost == null) return null;
    return p.price - p.cost;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">Productos</h1>
        <Button icon={<Plus size={18} />} onClick={openCreate}>
          Nuevo producto
        </Button>
      </div>

      <SearchInput placeholder="Buscar por nombre o código..." onChange={setSearch} className="max-w-sm" />

      {isLoading ? (
        <LoadingSpinner />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="Sin productos"
          description="Cargá los productos que vendés con su precio y código de barras."
          actionLabel="Nuevo producto"
          onAction={openCreate}
        />
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#333]">
                  <th className="text-left px-5 py-3 font-medium text-[#9CA3AF]">Nombre</th>
                  <th className="text-left px-5 py-3 font-medium text-[#9CA3AF] hidden md:table-cell">Código</th>
                  <th className="text-right px-5 py-3 font-medium text-[#9CA3AF]">Costo</th>
                  <th className="text-right px-5 py-3 font-medium text-[#9CA3AF]">Precio</th>
                  <th className="text-right px-5 py-3 font-medium text-[#9CA3AF] hidden lg:table-cell">Estado</th>
                  <th className="text-right px-5 py-3 font-medium text-[#9CA3AF]">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-[#333]/50 last:border-0 hover:bg-[#222] transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="text-white font-medium">{p.name}</div>
                      <div className="text-xs text-[#9CA3AF] mt-0.5 md:hidden">{p.barcode || 'Sin código'}</div>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <span className="font-mono text-xs text-[#9CA3AF]">{p.barcode || '—'}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right text-[#9CA3AF]">
                      ${p.cost != null ? p.cost.toFixed(2) : '0.00'}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-white font-semibold">
                        ${p.price != null ? p.price.toFixed(2) : '0.00'}
                      </span>
                      {margin(p) != null && (
                        <div className={`text-xs mt-0.5 ${margin(p)! >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {margin(p)! >= 0 ? '+' : ''}${margin(p)!.toFixed(2)}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right hidden lg:table-cell">
                      <Badge variant={p.is_active ? 'success' : 'default'} dot>
                        {p.is_active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" icon={<Pencil size={15} />} onClick={() => openEdit(p)} />
                        <Button variant="ghost" size="sm" icon={<Trash2 size={15} />} onClick={() => setDeleteModal(p.id)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editing ? 'Editar producto' : 'Nuevo producto'}
        maxWidth="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nombre"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ej: Botella de agua"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Costo"
              type="number"
              step="0.01"
              min="0"
              value={form.cost}
              onChange={(e) => setForm({ ...form, cost: e.target.value })}
              placeholder="0.00"
            />
            <Input
              label="Precio"
              type="number"
              step="0.01"
              min="0"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              placeholder="0.00"
            />
          </div>
          <div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Input
                  label="Código de barras"
                  value={form.barcode}
                  onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                  placeholder="Escanealo o escribilo a mano"
                  className="font-mono"
                />
              </div>
              <Button
                variant="secondary"
                type="button"
                icon={<ScanBarcode size={16} />}
                onClick={() => setScanOpen(true)}
                className="mb-0.5"
              >
                Escanear
              </Button>
            </div>
            <p className="text-xs text-[#9CA3AF] mt-1.5">
              Usá la cámara del celular o un lector USB para cargarlo automáticamente.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setForm({ ...form, is_active: !form.is_active })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                form.is_active ? 'bg-[#DC2626]' : 'bg-[#333]'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  form.is_active ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-sm text-white">Activo</span>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={closeModal}>Cancelar</Button>
            <Button type="submit" loading={createMut.isPending || updateMut.isPending}>
              {editing ? 'Guardar' : 'Crear'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={scanOpen} onClose={() => setScanOpen(false)} title="Escanear código de barras" maxWidth="sm">
        <div className="space-y-3">
          <div
            id="barcode-scanner-box"
            className="w-full rounded-lg overflow-hidden bg-black min-h-[200px]"
          />
          <p className="text-xs text-[#9CA3AF] text-center">
            Apuntá el código al centro de la pantalla. Se carga solo al leerlo.
          </p>
          <Button variant="secondary" type="button" className="w-full" onClick={() => setScanOpen(false)}>
            Cancelar
          </Button>
        </div>
      </Modal>

      <Modal isOpen={!!deleteModal} onClose={() => setDeleteModal(null)} title="Eliminar producto" maxWidth="sm">
        <p className="text-[#9CA3AF] text-sm mb-5">
          ¿Estás seguro de que deseas eliminar este producto? Esta acción no se puede deshacer.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteModal(null)}>Cancelar</Button>
          <Button variant="danger" loading={deleteMut.isPending} onClick={() => deleteModal && deleteMut.mutate(deleteModal)}>
            Eliminar
          </Button>
        </div>
      </Modal>
    </div>
  );
}
