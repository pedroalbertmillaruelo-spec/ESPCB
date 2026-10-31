"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, ArrowUpRight, CircuitBoard, Download, Eye, Heart, ImagePlus, Plus, Search, Sparkles, UploadCloud, X } from "lucide-react";
import type { GalleryProject } from "@/lib/gallery";
import { CAD_FORMATS, CATEGORIES, compactNumber, DIFFICULTIES, formatDate, LAYER_OPTIONS, LICENSES, SORTS } from "@/lib/gallery-options";
import { useAuth } from "./providers";
import { PrivacyNotice } from "./privacy-notice";

type SortValue = (typeof SORTS)[number]["value"];
export function Gallery({ initialProjects, compact = false }: { initialProjects: GalleryProject[]; compact?: boolean }) {
  const { user, openAuth } = useAuth();
  const [projects, setProjects] = useState(initialProjects);
  const [category, setCategory] = useState("Todos");
  const [difficulty, setDifficulty] = useState("Todas");
  const [sort, setSort] = useState<SortValue>("recent");
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<GalleryProject | null>(null);
  const [liking, setLiking] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [upload, setUpload] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [published, setPublished] = useState(false);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("proyecto");
    if (!id) return;
    let active = true;
    fetch(`/api/projects/${encodeURIComponent(id)}?view=1`, { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() : null)
      .then((data) => { if (!active || !data?.project) return; setDetail(data.project); setProjects((current) => current.map((item) => item.id === id ? data.project : item)); })
      .catch(() => { if (active) setDetailError("No se pudo cargar el proyecto enlazado."); });
    return () => { active = false; };
  }, []);
  const filtered = projects.filter((p) => (category === "Todos" || p.category === category) && (difficulty === "Todas" || p.difficulty === difficulty) && `${p.title} ${p.description} ${p.author} ${p.category} ${p.tags.join(" ")}`.toLocaleLowerCase("es").includes(search.trim().toLocaleLowerCase("es")));
  const sorted = [...filtered].sort((a, b) => {
    if (sort === "popular" && b.downloads !== a.downloads) return b.downloads - a.downloads;
    if (sort === "liked" && b.likes !== a.likes) return b.likes - a.likes;
    if (sort === "viewed" && b.views !== a.views) return b.views - a.views;
    const delta = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return sort === "oldest" ? -delta : delta;
  });
  const displayed = compact ? sorted.slice(0, 3) : sorted;
  function openUpload() { if (!user) { openAuth("register"); return; } setUploadError(""); setPublished(false); setUpload(true); }
  async function openProject(project: GalleryProject) {
    setDetailError(""); setDetail(project);
    try {
      const response = await fetch(`/api/projects/${project.id}?view=1`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setDetail((current) => current?.id === project.id ? data.project : current);
      setProjects((current) => current.map((item) => item.id === project.id ? data.project : item));
    } catch { setDetailError("No se pudieron actualizar los datos del proyecto."); }
  }
  async function toggleLike() {
    if (!detail) return;
    if (!user) { openAuth(); return; }
    setLiking(true); setDetailError("");
    try {
      const response = await fetch(`/api/projects/${detail.id}/like`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ liked: !detail.liked }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setDetail((current) => current?.id === detail.id ? { ...current, liked: data.liked, likes: data.likes } : current);
      setProjects((current) => current.map((item) => item.id === detail.id ? { ...item, liked: data.liked, likes: data.likes } : item));
    } catch (e) { setDetailError(e instanceof Error ? e.message : "No se ha podido guardar tu valoración."); }
    finally { setLiking(false); }
  }
  async function submitProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setUploadError(""); setUploading(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/projects", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const latestResponse = await fetch("/api/projects", { cache: "no-store" });
      if (!latestResponse.ok) throw new Error("El proyecto se guardó, pero no se pudo actualizar la galería.");
      const latest = await latestResponse.json();
      setProjects(latest.projects); setCategory("Todos"); setDifficulty("Todas"); setSearch(""); setSort("recent"); setPublished(true);
    } catch (e) { setUploadError(e instanceof Error ? e.message : "No se ha podido publicar el proyecto."); }
    finally { setUploading(false); }
  }
  return <section className={`gallery-section ${compact ? "" : "gallery-full"}`} id="galeria"><div className="container">
    <div className="section-heading gallery-heading"><div><p className="eyebrow"><span/> HECHO PARA COMPARTIR</p><h2>{compact ? <>Las ideas crecen <em>en comunidad.</em></> : <>Galería <em>PCB.</em></>}</h2><p className="gallery-heading-copy">{compact ? "Inspírate, descubre y comparte lo que eres capaz de crear." : "Un espacio para descubrir, compartir y dar vida a grandes ideas. Aquí las buenas ideas no se quedan en un cajón."}</p></div>{compact ? <Link href="/galeria" className="text-link">Ver toda la galería <ArrowRight size={17}/></Link> : <button className="btn btn-primary" onClick={openUpload}><Plus size={18}/> Publicar mi proyecto</button>}</div>
    {!compact && <div className="gallery-controls"><div className="category-tabs" aria-label="Filtrar por categoría">{["Todos", ...CATEGORIES].map((item) => <button type="button" key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div><div className="gallery-filter-row"><label className="search-box"><Search size={17}/><input placeholder="Buscar proyectos..." value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Buscar proyectos"/></label><label className="gallery-select"><span>Dificultad</span><select aria-label="Filtrar por dificultad" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}><option value="Todas">Todas</option>{DIFFICULTIES.map((item) => <option key={item}>{item}</option>)}</select></label><label className="gallery-select"><span>Ordenar por</span><select aria-label="Ordenar proyectos" value={sort} onChange={(e) => setSort(e.target.value as SortValue)}>{SORTS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><span className="gallery-count">{filtered.length} {filtered.length === 1 ? "proyecto" : "proyectos"}</span></div></div>}
    {displayed.length > 0 ? <div className="gallery-grid">{displayed.map((project) => <article key={project.id} className="project-card"><button type="button" className="project-card-open" onClick={() => void openProject(project)}><div className="project-image"><img src={project.image} alt={`Placa ${project.title}`}/><span className="project-tag">{project.category.toUpperCase()}</span><span className="project-arrow"><ArrowUpRight size={18}/></span></div><div className="project-body"><div className="project-card-title"><h3>{project.title}</h3><ArrowUpRight size={17}/></div><p>{project.description}</p><div className="project-metadata"><span>{project.difficulty}</span><span>{project.layers} {project.layers === 1 ? "capa" : "capas"}</span><span>{project.cadFormat}</span></div><div className="project-footer"><span className="author"><span className="author-avatar">{project.author.charAt(0).toUpperCase()}</span> {project.author}</span><span className="project-stats"><span><Download size={13}/>{compactNumber(project.downloads)}</span><span><Heart size={13}/>{compactNumber(project.likes)}</span><span><Eye size={13}/>{compactNumber(project.views)}</span></span></div></div></button></article>)}</div> : <div className="gallery-empty"><div className="gallery-empty-art"><span><CircuitBoard size={34} strokeWidth={1.4}/></span><i>✳</i><b>+</b></div><p className="eyebrow">{projects.length ? "SIGUE EXPLORANDO" : "UN ESPACIO PARA CREAR"}</p><h3>{projects.length ? "No encontramos proyectos." : "Todavía no hay proyectos."}</h3><p>{projects.length ? "Prueba con otra búsqueda o categoría." : "La galería está lista para tus ideas. Comparte tu diseño y sé el primero en formar parte de la comunidad."}</p>{projects.length ? <button className="text-button" onClick={() => { setCategory("Todos"); setDifficulty("Todas"); setSearch(""); }}>Limpiar filtros <ArrowRight size={15}/></button> : <button className="btn btn-primary" onClick={openUpload}><Plus size={16}/> Publicar el primer proyecto</button>}</div>}
    {compact && projects.length > 0 && <div className="gallery-bottom"><span><Sparkles size={17}/> ¿Tienes un diseño que merece ser compartido?</span><Link href="/galeria">Comparte tu proyecto <ArrowRight size={16}/></Link></div>}
  </div>
  {detail && <div className="modal-backdrop" onMouseDown={() => setDetail(null)}><div className="modal project-modal" role="dialog" aria-modal="true" aria-labelledby="project-title" onMouseDown={(e) => e.stopPropagation()}><button className="modal-close" onClick={() => setDetail(null)} aria-label="Cerrar"><X size={20}/></button><div className="project-modal-image"><img src={detail.image} alt={`Placa ${detail.title}`}/><span className="project-tag">{detail.category.toUpperCase()}</span></div><div className="project-modal-content"><p className="eyebrow">UN PROYECTO DE LA COMUNIDAD</p><h2 id="project-title">{detail.title}</h2><p className="modal-intro">{detail.description}</p><div className="project-specs"><span><strong>{detail.width} × {detail.height}</strong> mm</span><span><strong>{detail.layers}</strong> {detail.layers === 1 ? "capa" : "capas"}</span><span><strong>{detail.holes}</strong> agujeros/vías</span></div><div className="detail-meta"><span>{detail.difficulty}</span><span>{detail.cadFormat}</span><span>{detail.license}</span>{detail.components > 0 && <span>{detail.components} componentes</span>}</div>{detail.tags.length > 0 && <div className="detail-tags">{detail.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>}<div className="detail-community"><p className="detail-author">Creado por <strong>{detail.author}</strong> · {formatDate(detail.createdAt)}</p><div className="detail-stats"><span><Eye size={15}/> {compactNumber(detail.views)}</span><span><Download size={15}/> {compactNumber(detail.downloads)}</span><button className={detail.liked ? "liked" : ""} disabled={liking} onClick={() => void toggleLike()} aria-label={detail.liked ? "Quitar me gusta" : "Me gusta"}><Heart size={16} fill={detail.liked ? "currentColor" : "none"}/> {compactNumber(detail.likes)}</button></div></div>{detailError && <p className="form-error">{detailError}</p>}{detail.layers > 2 && <p className="demo-notice">Puedes descargar este diseño multicapa. Actualmente fabricamos placas de una o dos caras.</p>}<div className="detail-actions">{detail.layers <= 2 && <Link href={`/?proyecto=${encodeURIComponent(detail.id)}#cotizador`} className="btn btn-primary">Fabricar este diseño <ArrowRight size={17}/></Link>}<a className="btn btn-outline" href={`/api/projects/${detail.id}/gerber`} onClick={() => { setDetail((current) => current ? { ...current, downloads: current.downloads + 1 } : current); setProjects((current) => current.map((item) => item.id === detail.id ? { ...item, downloads: item.downloads + 1 } : item)); }}><Download size={17}/> Descargar Gerbers</a></div><Link className="report-link" href={`/notificar?proyecto=${encodeURIComponent(detail.id)}`}>Notificar contenido o infracción de derechos <ArrowUpRight size={13}/></Link></div></div></div>}
  {upload && <div className="modal-backdrop" onMouseDown={() => setUpload(false)}><div className="modal upload-modal" role="dialog" aria-modal="true" aria-labelledby="upload-title" onMouseDown={(e) => e.stopPropagation()}><button className="modal-close" onClick={() => setUpload(false)} aria-label="Cerrar"><X size={20}/></button>{published ? <div className="published-state"><div className="success-icon"><Sparkles size={25}/></div><p className="eyebrow">¡YA FORMA PARTE DE LA GALERÍA!</p><h2>Las buenas ideas se comparten.</h2><p>Tu proyecto ya está publicado y listo para inspirar a otros makers.</p><button className="btn btn-primary full" onClick={() => setUpload(false)}>Ver la galería <ArrowRight size={17}/></button></div> : <><p className="eyebrow">COMPARTE LO QUE CREAS</p><h2 id="upload-title">Tu proyecto merece ser visto.</h2><p className="modal-intro">Añade tu diseño a la galería. Tus archivos serán públicos para descargar y fabricar.</p><form className="form-stack" onSubmit={submitProject}><div className="form-two"><label>Nombre del proyecto<input name="title" required minLength={3} maxLength={90} placeholder="Ej. Mi primer sintetizador"/></label><label>Categoría<select name="category" defaultValue={CATEGORIES[0]}>{CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></label></div><label>Descripción<textarea name="description" required minLength={10} maxLength={1500} rows={3} placeholder="Cuéntanos qué hace especial a tu proyecto..."/></label><div className="form-two"><label>Dificultad<select name="difficulty">{DIFFICULTIES.map((item) => <option key={item}>{item}</option>)}</select></label><label>Formato CAD<select name="cadFormat" defaultValue="Solo Gerber">{CAD_FORMATS.map((item) => <option key={item}>{item}</option>)}</select></label></div><div className="form-two"><label>Licencia<select name="license">{LICENSES.map((item) => <option key={item}>{item}</option>)}</select></label><label>Capas de cobre<select name="layers" defaultValue="2">{LAYER_OPTIONS.map((item) => <option value={item} key={item}>{item} {item === 1 ? "capa" : "capas"}</option>)}</select></label></div><p className="upload-hint">Puedes compartir diseños multicapa; la fabricación está disponible para 1 o 2 caras.</p><div className="form-two"><label>Ancho (mm)<input name="width" type="number" required min="1" max="200" step="0.01" placeholder="50"/></label><label>Alto (mm)<input name="height" type="number" required min="1" max="200" step="0.01" placeholder="50"/></label></div><div className="form-two"><label>Etiquetas <span>(separadas por comas)</span><input name="tags" maxLength={200} placeholder="sintetizador, DIY, audio"/></label><label>Número de componentes <span>(opcional)</span><input name="components" type="number" min="0" max="10000" defaultValue="0"/></label></div><div className="form-two upload-file-fields"><label><span><UploadCloud size={16}/> Gerbers en ZIP <small>máx. 2 MB</small></span><input name="gerber" type="file" accept=".zip,application/zip" required/></label><label><span><ImagePlus size={16}/> Imagen de portada <small>máx. 1 MB</small></span><input name="image" type="file" accept="image/png,image/jpeg,image/webp" required/></label></div><PrivacyNotice purpose="gallery"/><label className="checkbox-label"><input name="rights" value="true" type="checkbox" required/><span>Confirmo que tengo derecho a compartir este diseño y sus imágenes, y autorizo su publicación y descarga públicas bajo la licencia elegida. He leído las <a className="privacy-link" href="/legal/condiciones" target="_blank" rel="noopener noreferrer">condiciones de la galería</a>.</span></label>{uploadError && <p className="form-error" role="alert">{uploadError}</p>}<button className="btn btn-primary full" disabled={uploading}>{uploading ? "Publicando y analizando..." : "Publicar mi proyecto"}<ArrowRight size={17}/></button></form></>}</div></div>}
  </section>;
}
