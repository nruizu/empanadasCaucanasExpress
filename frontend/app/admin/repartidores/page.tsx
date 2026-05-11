"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useAuth from "@/context/AuthContext";
import { getAdminUsers, updateAdminUserRole, type AdminUser } from "@/lib/admin-users-api";

export default function AdminRepartidoresPage() {
  const router = useRouter();
  const { token, user, authReady } = useAuth();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [updating, setUpdating] = useState<number | null>(null);

  const canAccess = useMemo(() => {
    return Boolean(token && user?.is_staff);
  }, [token, user]);

  const loadUsers = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const loadedUsers = await getAdminUsers(token);
      setUsers(loadedUsers);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "No se pudo cargar la lista de usuarios");
    } finally {
      setLoading(false);
    }
  }, [token]);

  const handleRoleChange = useCallback(
    async (userId: number, newRole: "customer" | "courier") => {
      if (!token) return;

      setUpdating(userId);
      setError(null);
      setSuccess(null);

      try {
        const updated = await updateAdminUserRole(token, userId, newRole);
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? updated : u))
        );
        setSuccess(
          `Rol actualizado a ${newRole === "courier" ? "Repartidor" : "Cliente"}`
        );
        setTimeout(() => setSuccess(null), 3000);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "Error al actualizar el rol del usuario");
      } finally {
        setUpdating(null);
      }
    },
    [token]
  );

  useEffect(() => {
    if (!authReady) return;

    if (!token) {
      router.replace("/login");
      return;
    }

    if (user && !user.is_staff) {
      router.replace("/catalogo");
      return;
    }

    if (canAccess) {
      void loadUsers();
    }
  }, [authReady, token, user, canAccess, loadUsers, router]);

  const couriers = users.filter((u) => u.role === "courier");
  const customers = users.filter((u) => u.role === "customer");

  if (!authReady || !canAccess) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Gestión de Repartidores
          </h1>
          <p className="text-gray-600">
            Asigna roles de repartidor a los usuarios de tu sistema
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded">
            {success}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
            <p className="mt-4 text-gray-600">Cargando usuarios...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Repartidores */}
            <div className="bg-white rounded-lg shadow">
              <div className="bg-green-600 text-white p-4 rounded-t-lg">
                <h2 className="text-xl font-bold">
                  Repartidores ({couriers.length})
                </h2>
              </div>
              <div className="p-4">
                {couriers.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    Sin repartidores asignados
                  </p>
                ) : (
                  <div className="space-y-3">
                    {couriers.map((courier) => (
                      <div
                        key={courier.id}
                        className="flex items-center justify-between p-3 bg-green-50 rounded border border-green-200"
                      >
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">
                            {courier.full_name || courier.username}
                          </p>
                          <p className="text-sm text-gray-600">
                            {courier.email}
                          </p>
                          {courier.phone && (
                            <p className="text-sm text-gray-600">
                              {courier.phone}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() =>
                            handleRoleChange(courier.id, "customer")
                          }
                          disabled={updating === courier.id}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white text-sm rounded transition"
                        >
                          {updating === courier.id ? "..." : "Quitar"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Clientes */}
            <div className="bg-white rounded-lg shadow">
              <div className="bg-blue-600 text-white p-4 rounded-t-lg">
                <h2 className="text-xl font-bold">
                  Clientes ({customers.length})
                </h2>
              </div>
              <div className="p-4">
                {customers.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    Sin clientes registrados
                  </p>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {customers.map((customer) => (
                      <div
                        key={customer.id}
                        className="flex items-center justify-between p-3 bg-blue-50 rounded border border-blue-200"
                      >
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">
                            {customer.full_name || customer.username}
                          </p>
                          <p className="text-sm text-gray-600">
                            {customer.email}
                          </p>
                          {customer.phone && (
                            <p className="text-sm text-gray-600">
                              {customer.phone}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() =>
                            handleRoleChange(customer.id, "courier")
                          }
                          disabled={updating === customer.id}
                          className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-sm rounded transition"
                        >
                          {updating === customer.id ? "..." : "Promover"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
