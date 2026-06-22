import { useAuthStore } from '../stores/authStore';
import { User, UserRole } from '../types/auth';
import { hasPermission, Permission } from '../utils/permissions';

interface UseAuthReturn {
  user:            User | null;
  isAuthenticated: boolean;
  isLoading:       boolean;
  role:            UserRole | null;
  workshopId:      number | null;
  can:             (permission: Permission) => boolean;
  logout:          () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const user            = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading       = useAuthStore((s) => s.isLoading);
  const logout          = useAuthStore((s) => s.logout);

  return {
    user,
    isAuthenticated,
    isLoading,
    role:       user?.role ?? null,
    workshopId: user?.workshopId ?? null,
    can: (permission) => (user ? hasPermission(user.role, permission) : false),
    logout,
  };
}
