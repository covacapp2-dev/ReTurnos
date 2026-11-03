import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, Outlet, useParams, useLocation } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import LoadingSpinner from './components/ui/LoadingSpinner';
import BusinessBootstrap from './components/BusinessBootstrap';
import SubscriptionBlocked from './components/SubscriptionBlocked';
import { hasActiveAccess } from './services/subscription';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const NewAppointmentPage = lazy(() => import('./pages/NewAppointmentPage'));
const AppointmentsPage = lazy(() => import('./pages/AppointmentsPage'));
const AppointmentDetailPage = lazy(() => import('./pages/AppointmentDetailPage'));
const AgendaPage = lazy(() => import('./pages/AgendaPage'));
const ServicesPage = lazy(() => import('./pages/ServicesPage'));
const ResourcesPage = lazy(() => import('./pages/ResourcesPage'));
const ProductsPage = lazy(() => import('./pages/ProductsPage'));
const NewSalePage = lazy(() => import('./pages/NewSalePage'));
const SportsLobbyPage = lazy(() => import('./pages/SportsLobbyPage'));
const CourtsPage = lazy(() => import('./pages/CourtsPage'));
const ProfessionalsPage = lazy(() => import('./pages/ProfessionalsPage'));
const ClientsPage = lazy(() => import('./pages/ClientsPage'));
const BranchesPage = lazy(() => import('./pages/BranchesPage'));
const HorariosPage = lazy(() => import('./pages/HorariosPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const SubscriptionPage = lazy(() => import('./pages/SubscriptionPage'));
const AccountPage = lazy(() => import('./pages/AccountPage'));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'));
const SupportPage = lazy(() => import('./pages/SupportPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const PublicBookingPage = lazy(() => import('./pages/public/PublicBookingPage'));
const PublicBookingSuccessPage = lazy(() => import('./pages/public/PublicBookingSuccessPage'));

const MainLayout = lazy(() => import('./components/layout/MainLayout'));
const AuthLayout = lazy(() => import('./components/layout/AuthLayout'));
const PublicLayout = lazy(() => import('./components/layout/PublicLayout'));

function LoadingFallback() {
  return (
    <div className="flex h-screen items-center justify-center">
      <LoadingSpinner size="lg" className="py-0" />
    </div>
  );
}

function ProtectedRoute({ requireBusiness = true }: { requireBusiness?: boolean }) {
  const { user, business, loading } = useAuthStore();
  const location = useLocation();

  if (loading) {
    return <LoadingFallback />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requireBusiness && !business) {
    return <BusinessBootstrap />;
  }

  // Suscripción vencida o impaga → se bloquea el acceso,
  // salvo para pagar (o ver configuración).
  if (requireBusiness && business && !hasActiveAccess(business)) {
    const path = location.pathname;
    const canPay = path.startsWith('/subscription') || path.startsWith('/settings');
    if (!canPay) {
      return <SubscriptionBlocked />;
    }
  }

  return <Outlet />;
}

function RedirectToBooking() {
  const { slug } = useParams<{ slug: string }>();
  return <Navigate to={`/book/${slug}`} replace />;
}

// Inicio según el tipo de sistema elegido al registrarse:
// "general" → dashboard normal | "sports" → lobby de complejo deportivo
function HomeRoute() {
  const { user } = useAuthStore();
  const bookingMode = user?.user_metadata?.booking_mode as string | undefined;
  return bookingMode === 'sports' ? <SportsLobbyPage /> : <DashboardPage />;
}

export default function App() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="/dashboard" element={<HomeRoute />} />
            <Route path="/appointments/new" element={<NewAppointmentPage />} />
            <Route path="/appointments" element={<AppointmentsPage />} />
            <Route path="/appointments/:id" element={<AppointmentDetailPage />} />
            <Route path="/agenda" element={<AgendaPage />} />
            <Route path="/services" element={<ServicesPage />} />
            <Route path="/resources" element={<ResourcesPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/sales/new" element={<NewSalePage />} />
            <Route path="/sports" element={<CourtsPage />} />
            <Route path="/sports/:sport" element={<CourtsPage />} />
            <Route path="/professionals" element={<ProfessionalsPage />} />
            <Route path="/clients" element={<ClientsPage />} />
            <Route path="/branches" element={<BranchesPage />} />
            <Route path="/horarios" element={<HorariosPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/subscription" element={<SubscriptionPage />} />
            <Route path="/support" element={<SupportPage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute requireBusiness={false} />}>
          <Route element={<MainLayout />}>
            <Route path="/onboarding" element={<OnboardingPage />} />
          </Route>
        </Route>

        <Route element={<PublicLayout />}>
          <Route path="/book/:slug" element={<PublicBookingPage />} />
          <Route path="/book/:slug/exito" element={<PublicBookingSuccessPage />} />
        </Route>

        <Route path="/:slug" element={<RedirectToBooking />} />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}
