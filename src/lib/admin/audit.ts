import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface AuditEntry {
  action: string;
  adminId?: string | null;
  actorEmail?: string | null;
  entityType?: string;
  entityId?: string;
  details?: Record<string, unknown>;
  ip?: string | null;
}

/** Nombres legibles para el registro de auditoría. */
export const AUDIT_LABEL: Record<string, string> = {
  "auth.setup": "Configuración inicial (primer dueño)",
  "auth.login": "Inicio de sesión",
  "auth.login_failed": "Intento de inicio de sesión fallido",
  "auth.logout": "Cierre de sesión",
  "auth.logout_all": "Cerró todas sus sesiones",
  "auth.password_changed": "Cambio de contraseña",
  "auth.password_reset_requested": "Solicitud de recuperación de contraseña",
  "auth.password_reset": "Contraseña restablecida con enlace",
  "admin.created": "Administrador creado",
  "admin.activated": "Administrador activado",
  "admin.deactivated": "Administrador desactivado",
  "admin.role_changed": "Rol cambiado",
  "admin.password_reset_by_owner": "Contraseña restablecida por el dueño",
  "admin.sessions_revoked": "Sesiones cerradas por el dueño",
  "product.created": "Producto creado",
  "product.updated": "Producto editado",
  "product.activated": "Producto activado",
  "product.deactivated": "Producto desactivado",
  "product.deleted": "Producto eliminado",
  "product.stock_updated": "Inventario ajustado",
  "category.created": "Categoría creada",
  "category.updated": "Categoría editada",
  "category.deleted": "Categoría eliminada",
  "order.status_changed": "Estado de pedido cambiado",
  "order.manual_payment_confirmed": "Pago manual confirmado",
  "upload.image": "Imagen subida",
};

/** Nunca interrumpe la acción principal: si el registro falla, solo lo deja en el log del servidor. */
export async function audit(entry: AuditEntry, db: PrismaClient = prisma): Promise<void> {
  try {
    await db.adminAuditLog.create({
      data: {
        action: entry.action,
        adminId: entry.adminId ?? null,
        actorEmail: entry.actorEmail ?? null,
        entityType: entry.entityType ?? null,
        entityId: entry.entityId ?? null,
        details: entry.details ? (JSON.parse(JSON.stringify(entry.details)) as Prisma.InputJsonValue) : undefined,
        ip: entry.ip ?? null,
      },
    });
  } catch (e) {
    console.error("[audit] no se pudo registrar", entry.action, e instanceof Error ? e.message : e);
  }
}
