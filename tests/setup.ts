import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Las pruebas NUNCA tocan una base de datos real: cada servicio recibe la base en memoria (fake-db).
// Este mock evita que el cliente de Prisma intente cargar su motor al importar los módulos.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
