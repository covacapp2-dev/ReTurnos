import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  ScanBarcode,
  Search,
  Receipt,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '../hooks/useAuth';
import { getProducts } from '../services/products';
import { createSale, getSales } from '../services/sales';
import type { Product } from '../types';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/ui/LoadingSpinner';

interface CartLine {
  product: Product;
  quantity: number;
}

export default function NewSalePage() {
  const { business } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [notes, setNotes] = useState('');
  const [scanOpen, setScanOpen] = useState(false);
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', business?.id],
    queryFn: () => getProducts(business!.id),
    enabled: !!business?.id,
    select: (res) => (res.data ?? []).filter((p) => p.is_active),
  });

  const startOfDay = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, []);

  const { data: todaySales = [] } = useQuery({
    queryKey: ['sales', business?.id, 'today'],
    queryFn: () => getSales(business!.id, { from: startOfDay }),
    enabled: !!business?.id,
    select: (res) => res.data ?? [],
  });

  // --- Carrito ---
  const addToCart = useCallback((product: Product) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
        return prev.map((l) =>
          l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    setSearch('');
  }, []);

  const changeQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) =>
          l.product.id === productId ? { ...l, quantity: l.quantity + delta } : l
        )
        .filter((l) => l.quantity > 0)
    );
  };

  const removeLine = (productId: string) => {
    setCart((prev) => prev.filter((l) => l.product.id !== productId));
  };

  const total = cart.reduce((sum, l) => sum + l.quantity * (l.product.price ?? 0), 0);
  const itemCount = cart.reduce((sum, l) => sum + l.quantity, 0);

  // --- Búsqueda / escaneo ---
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products.slice(0, 20);
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          (p.barcode ?? '').toLowerCase().includes(term)
      )
      .slice(0, 20);
  }, [products, search]);

  const handleSearchEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const term = search.trim().toLowerCase();
    if (!term) return;
    const exact = products.find((p) => (p.barcode ?? '').toLowerCase() === term);
    const target = exact ?? (filtered.length === 1 ? filtered[0] : null);
    if (target) {
      addToCart(target);
    } else {
      toast.error('Producto no encontrado');
    }
  };

  const stopScan = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) return;
    try {
      await scanner.stop();
    } catch {
      /* ya se detuvo */
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
      const scanner = new Html5Qrcode('sale-scanner-box', {
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
          const found = products.find(
            (p) => (p.barcode ?? '').toLowerCase() === decodedText.toLowerCase()
          );
          if (found) {
            addToCart(found);
            setScanOpen(false);
            toast.success(`${found.name} agregado`);
          } else {
            toast.error('Ese código no corresponde a ningún producto');
            setScanOpen(false);
          }
        },
        () => {
          /* sin lectura en este cuadro */
        }
      );
    } catch {
      scannerRef.current = null;
      setScanOpen(false);
      toast.error('No se pudo abrir la cámara. Revisá los permisos del navegador.');
    }
  }, [products, addToCart]);

  useEffect(() => {
    if (scanOpen) void startScan();
    else void stopScan();
  }, [scanOpen, startScan, stopScan]);

  useEffect(() => () => void stopScan(), [stopScan]);

  // --- Guardar venta ---
  const saveMut = useMutation({
    mutationFn: async () => {
      const res = await createSale(
        business!.id,
        cart.map((l) => ({
          product_id: l.product.id,
          product_name: l.product.name,
          quantity: l.quantity,
          unit_price: l.product.price ?? 0,
          unit_cost: l.product.cost ?? 0,
        })),
        notes
      );
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: (sale) => {
      queryClient.invalidateQueries({ queryKey: ['sales', business?.id] });
      toast.success(`Venta registrada — Total $${sale?.total.toFixed(2)}`);
      setCart([]);
      setNotes('');
      searchRef.current?.focus();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Error al registrar venta'),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">Cargar venta</h1>
        <div className="flex items-center gap-3 text-sm text-[#9CA3AF]">
          <Receipt size={16} />
          <span>
            {todaySales.length} venta{todaySales.length === 1 ? '' : 's'} hoy
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* --- Productos --- */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
                />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={handleSearchEnter}
                  placeholder="Buscar producto o escanear código..."
                  className="w-full bg-[#111] border border-[#333] rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#DC2626]"
                  autoFocus
                />
              </div>
              <Button
                variant="secondary"
                icon={<ScanBarcode size={16} />}
                onClick={() => setScanOpen(true)}
              >
                Escanear
              </Button>
            </div>
            <p className="text-xs text-[#9CA3AF] mt-2">
              Escaneá el código con la cámara o con un lector USB y el producto se agrega solo.
              También podés buscar por nombre y hacer clic.
            </p>
          </Card>

          {isLoading ? (
            <LoadingSpinner />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Sin productos"
              description={
                search ? 'No se encontró ningún producto con esa búsqueda.' : 'Cargá productos primero.'
              }
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="text-left rounded-lg border border-[#333] bg-[#1A1A1A] p-4 hover:border-[#DC2626]/60 hover:bg-[#1A1A1A]/80 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-white font-medium truncate">{p.name}</div>
                      <div className="text-xs text-[#9CA3AF] font-mono mt-0.5 truncate">
                        {p.barcode || 'Sin código'}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-white font-semibold">
                        ${p.price != null ? p.price.toFixed(2) : '0.00'}
                      </div>
                      <div className="text-[#DC2626]">
                        <Plus size={14} className="ml-auto" />
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* --- Carrito --- */}
        <Card className="lg:sticky lg:top-6">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart size={18} className="text-[#DC2626]" />
            <h2 className="text-white font-semibold">Venta actual</h2>
            {itemCount > 0 && (
              <span className="ml-auto text-xs bg-[#DC2626] text-white rounded-full px-2 py-0.5">
                {itemCount}
              </span>
            )}
          </div>

          {cart.length === 0 ? (
            <p className="text-sm text-[#9CA3AF] text-center py-8">
              Agregá productos para empezar la venta.
            </p>
          ) : (
            <div className="space-y-3">
              {cart.map((line) => (
                <div
                  key={line.product.id}
                  className="border border-[#333] rounded-lg p-3 bg-[#111]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm text-white font-medium truncate">
                      {line.product.name}
                    </div>
                    <button
                      onClick={() => removeLine(line.product.id)}
                      className="text-[#9CA3AF] hover:text-red-400 shrink-0"
                      title="Quitar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => changeQty(line.product.id, -1)}
                        className="w-7 h-7 rounded-md border border-[#333] flex items-center justify-center text-[#9CA3AF] hover:border-[#DC2626] hover:text-white"
                      >
                        <Minus size={13} />
                      </button>
                      <span className="text-white text-sm w-6 text-center">{line.quantity}</span>
                      <button
                        onClick={() => changeQty(line.product.id, 1)}
                        className="w-7 h-7 rounded-md border border-[#333] flex items-center justify-center text-[#9CA3AF] hover:border-[#DC2626] hover:text-white"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                    <div className="text-white text-sm font-semibold">
                      ${((line.product.price ?? 0) * line.quantity).toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-[#333] mt-4 pt-4">
            <label className="text-xs text-[#9CA3AF]">Nota (opcional)</label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Pago en efectivo"
              className="mt-1"
            />
          </div>

          <div className="flex items-center justify-between mt-4 mb-3">
            <span className="text-[#9CA3AF] text-sm">Total</span>
            <span className="text-white text-2xl font-bold">${total.toFixed(2)}</span>
          </div>

          <Button
            className="w-full"
            size="lg"
            disabled={cart.length === 0}
            loading={saveMut.isPending}
            onClick={() => saveMut.mutate()}
          >
            Registrar venta
          </Button>
        </Card>
      </div>

      {/* --- Ventas de hoy --- */}
      {todaySales.length > 0 && (
        <Card>
          <h2 className="text-white font-semibold mb-4">Ventas de hoy</h2>
          <div className="space-y-2">
            {todaySales.map((sale) => (
              <div
                key={sale.id}
                className="flex items-center justify-between border-b border-[#333]/50 last:border-0 py-2.5"
              >
                <div>
                  <div className="text-white text-sm">
                    {sale.items.reduce((s, i) => s + i.quantity, 0)} ítem
                    {sale.items.reduce((s, i) => s + i.quantity, 0) === 1 ? '' : 's'}
                    {sale.notes && (
                      <span className="text-[#9CA3AF]"> · {sale.notes}</span>
                    )}
                  </div>
                  <div className="text-xs text-[#9CA3AF]">
                    {format(new Date(sale.created_at), 'HH:mm', { locale: es })}
                  </div>
                </div>
                <div className="text-white font-semibold">${sale.total.toFixed(2)}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* --- Escáner --- */}
      {scanOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-[#1A1A1A] border border-[#333] rounded-xl p-4 w-full max-w-sm">
            <h3 className="text-white font-semibold mb-3">Escanear producto</h3>
            <div
              id="sale-scanner-box"
              className="w-full rounded-lg overflow-hidden bg-black min-h-[200px]"
            />
            <p className="text-xs text-[#9CA3AF] text-center mt-3">
              Apuntá el código al centro de la pantalla.
            </p>
            <Button
              variant="secondary"
              className="w-full mt-3"
              onClick={() => setScanOpen(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
