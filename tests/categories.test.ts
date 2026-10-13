import { beforeEach, describe, expect, it } from "vitest";
import { categoryCreateInput, categoryUpdateInput, productInput } from "@/lib/schemas/admin";
import { createCategory, deleteCategory, listCategoriesAdmin, updateCategory } from "@/lib/services/categories";
import { createProduct, setProductActive } from "@/lib/services/admin-products";
import { parseFilters } from "@/hooks/useProductFilters";
import { createFakeDb } from "./helpers/fake-db";

let f: ReturnType<typeof createFakeDb>;
beforeEach(() => { f = createFakeDb(); f.seed.category("calzado", { label: "Calzado", sortOrder: 10 }); });

const cat = (over: Record<string, unknown> = {}) => categoryCreateInput.parse({ label: "Relojes", slug: "relojes", ...over });
const product = (over: Record<string, unknown> = {}) =>
  productInput.parse({ name: "Casio G-Shock", brand: "Casio", description: "Reloj resistente a golpes.", priceCOP: 450000, category: "relojes", images: ["https://images.unsplash.com/photo-1"], stock: 3, ...over });

describe("validación de categorías", () => {
  it("exige slug con formato correcto y no reservado", () => {
    expect(categoryCreateInput.safeParse({ label: "Relojes", slug: "Relojes Finos" }).success).toBe(false);
    expect(categoryCreateInput.safeParse({ label: "Relojes", slug: "-relojes" }).success).toBe(false);
    expect(categoryCreateInput.safeParse({ label: "Todo", slug: "todo" }).success).toBe(false);
    expect(categoryCreateInput.safeParse({ label: "R", slug: "r" }).success).toBe(false);
    expect(categoryCreateInput.safeParse({ label: "Bolsos y morrales", slug: "bolsos-y-morrales" }).success).toBe(true);
  });
  it("rechaza imágenes de hosts no permitidos y una edición vacía", () => {
    expect(categoryCreateInput.safeParse({ label: "Relojes", slug: "relojes", imageUrl: "https://evil.com/a.jpg" }).success).toBe(false);
    expect(categoryCreateInput.parse({ label: "Relojes", slug: "relojes", imageUrl: "" }).imageUrl).toBeNull();
    expect(categoryUpdateInput.safeParse({}).success).toBe(false);
  });
});

describe("crear, editar y eliminar categorías", () => {
  it("crea una categoría nueva al final del orden y aparece en el listado con sus conteos", async () => {
    const c = await createCategory(cat(), f.db);
    expect(c).toMatchObject({ slug: "relojes", label: "Relojes", active: true, sortOrder: 20 });
    const list = await listCategoriesAdmin(f.db);
    expect(list.map((x) => x.slug)).toContain("relojes");
    expect(list.find((x) => x.slug === "relojes")).toMatchObject({ productCount: 0, activeProductCount: 0 });
  });
  it("rechaza slug o nombre duplicados (409)", async () => {
    await createCategory(cat(), f.db);
    await expect(createCategory(cat(), f.db)).rejects.toMatchObject({ status: 409 });
    await expect(createCategory(cat({ slug: "relojes-2", label: "RELOJES" }), f.db)).rejects.toMatchObject({ status: 409 });
  });
  it("un producto puede usar la categoría nueva sin tocar código", async () => {
    await createCategory(cat(), f.db);
    const p = await createProduct(product(), f.db);
    expect(p.categoryId).toBe(f.state.category.find((c) => c.slug === "relojes")!.id);
  });
  it("no se puede ocultar una categoría con productos activos", async () => {
    const c = await createCategory(cat(), f.db);
    const p = await createProduct(product(), f.db);
    await expect(updateCategory(c.id, { active: false }, f.db)).rejects.toMatchObject({ status: 409 });
    await setProductActive(p.id, false, f.db);
    expect((await updateCategory(c.id, { active: false }, f.db)).active).toBe(false);
  });
  it("no se crean ni activan productos en una categoría oculta", async () => {
    const c = await createCategory(cat(), f.db);
    await updateCategory(c.id, { active: false }, f.db);
    await expect(createProduct(product(), f.db)).rejects.toMatchObject({ status: 400 });
    const inactive = await createProduct(product({ active: false }), f.db); // inactivo sí se permite
    await expect(setProductActive(inactive.id, true, f.db)).rejects.toMatchObject({ status: 409 });
  });
  it("solo se elimina una categoría vacía (sin productos huérfanos)", async () => {
    const c = await createCategory(cat(), f.db);
    await createProduct(product({ active: false }), f.db);
    await expect(deleteCategory(c.id, f.db)).rejects.toMatchObject({ status: 409 });
    const empty = await createCategory(cat({ slug: "bolsos", label: "Bolsos" }), f.db);
    await deleteCategory(empty.id, f.db);
    expect(f.state.category.some((x) => x.slug === "bolsos")).toBe(false);
  });
  it("renombrar no cambia el slug (los enlaces siguen funcionando)", async () => {
    const c = await createCategory(cat(), f.db);
    const u = await updateCategory(c.id, { label: "Relojes y smartwatches" }, f.db);
    expect(u).toMatchObject({ slug: "relojes", label: "Relojes y smartwatches" });
  });
  it("404 al editar o eliminar una categoría inexistente", async () => {
    await expect(updateCategory("nope", { label: "X y Z" }, f.db)).rejects.toMatchObject({ status: 404 });
    await expect(deleteCategory("nope", f.db)).rejects.toMatchObject({ status: 404 });
  });
});

describe("filtro de categoría en el catálogo", () => {
  const params = (q: string) => new URLSearchParams(q);
  it("acepta categorías que existen en la base de datos y descarta las demás", () => {
    expect(parseFilters(params("categoria=relojes"), ["calzado", "relojes"]).category).toBe("relojes");
    expect(parseFilters(params("categoria=inexistente"), ["calzado"]).category).toBe("todo");
    expect(parseFilters(params("categoria=<script>")).category).toBe("todo");
    expect(parseFilters(params("")).category).toBe("todo");
  });
});
