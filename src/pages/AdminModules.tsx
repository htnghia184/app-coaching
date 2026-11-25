import { useEffect, useState } from 'react';
import { parseModuleDraft } from '../modules/moduleImport';
import type { ModuleManifest } from '../modules/ree';
import { Link } from 'react-router-dom';
import { listIeltsModulesForAdmin, type LearningModuleSummary } from '../lib/coachingService';
import { REE_MODULE_ID, reeManifest, STAGES, validateModuleManifest } from '../modules/ree';

/** Publication is intentionally unavailable until private keys and source assets are verified. */
function publicationGates(module: LearningModuleSummary): string[] {
  const reasons: string[] = [];
  if (module.id !== REE_MODULE_ID || module.content.manifest_key !== reeManifest.key ||
      module.content.content_version !== reeManifest.version) {
    reasons.push('Chưa có manifest ứng dụng khớp ID và phiên bản này.');
    return reasons;
  }
  reasons.push(...validateModuleManifest(reeManifest));
  // Media is optional by learning design; validate only assets explicitly required by this module.
  reasons.push('Chưa xác nhận bản đối chiếu nội dung với Word gốc và khóa đáp án riêng cho phiên bản này.');
  reasons.push('Cần xác nhận RLS, quyền media và kiểm thử vai trò trên môi trường phát hành.');
  return reasons;
}

export function AdminModules() {
  const [modules, setModules] = useState<LearningModuleSummary[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [draftJson, setDraftJson] = useState('');
  const [importPreview, setImportPreview] = useState<ModuleManifest | null>(null);
  const [importError, setImportError] = useState('');

  useEffect(() => {
    void listIeltsModulesForAdmin().then((rows) => {
      setModules(rows);
      setSelectedId(rows[0]?.id ?? '');
    }).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : 'Không tải được module.');
    }).finally(() => setLoading(false));
  }, []);

  const selected = modules.find((module) => module.id === selectedId);
  const manifest = selected?.id === REE_MODULE_ID &&
    selected.content.manifest_key === reeManifest.key &&
    selected.content.content_version === reeManifest.version ? reeManifest : null;
  const gates = selected ? publicationGates(selected) : [];

  return <div className="page-container space-y-6">
    <header>
      <Link to="/admin" className="text-sm text-emblue underline">← Enrollment</Link>
      <h1 className="mt-2 text-xl font-semibold text-master sm:text-2xl">IELTS micro-module</h1>
      <p className="mt-1 text-sm text-slate-600">Danh mục và bản xem trước theo phiên bản. Nội dung đã Published được giữ nguyên.</p>
    </header>
    <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-3" aria-label="Import JSON Draft">
      <h2 className="font-semibold text-master">Import JSON · Draft Preview (chưa lưu database)</h2>
      <p className="text-sm text-slate-600">Dán manifest JSON công khai để kiểm tra cấu trúc và xem trước sáu giai đoạn. Không dán đáp án/khóa chấm. Đây là kiểm tra ở trình duyệt, không phải Publish Gate.</p>
      <textarea aria-label="Module JSON" value={draftJson} onChange={(e) => { setDraftJson(e.target.value); setImportPreview(null); setImportError(''); }} rows={6} className="w-full rounded-lg border border-slate-300 p-3 font-mono text-xs" placeholder='{ "id": "...", "stages": ["Discover", "Learn", "Practice", "Apply", "Reflect", "Verify"], ... }' />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => { try { setImportPreview(parseModuleDraft(draftJson)); setImportError(''); } catch (err) { setImportPreview(null); setImportError(err instanceof Error ? err.message : 'Không đọc được JSON.'); } }} className="rounded-lg bg-master px-4 py-2 text-sm font-semibold text-white">Kiểm tra & xem trước</button>
        <button type="button" onClick={() => { setDraftJson(JSON.stringify(reeManifest, null, 2)); setImportPreview(null); setImportError(''); }} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Nạp REE mẫu</button>
      </div>
      {importError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{importError}</p>}
      {importPreview && <div className="rounded-lg border border-emblue/30 bg-emblue/5 p-4 space-y-2">
        <p className="font-semibold text-master">{importPreview.title} · v{importPreview.version} · {importPreview.level}</p>
        <p className="text-sm">{importPreview.outcome}</p>
        <ol className="list-decimal pl-5 text-sm">{STAGES.map(stage => <li key={stage}>{stage} · {importPreview.stageMinutes[stage]} phút</li>)}</ol>
        <p className="text-xs text-amber-800">Preview hợp lệ ở client. Chưa lưu Draft, chưa nhập khóa đáp án, chưa Publish. Cần backend kiểm tra schema và phân quyền trước khi bật lưu.</p>
      </div>}
    </section>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {loading ? <p>Đang tải module…</p> : modules.length === 0 ?
      <p className="rounded-xl bg-white p-4 text-sm text-slate-600">Chưa có IELTS module trong database.</p> :
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <section aria-label="Danh sách module" className="space-y-2">
          {modules.map((module) => <button key={module.id} type="button" onClick={() => setSelectedId(module.id)}
            className={`w-full rounded-xl border bg-white p-4 text-left ${selectedId === module.id ? 'border-emblue' : 'border-slate-200'}`}>
            <span className="block font-semibold text-master">{module.title}</span>
            <span className="mt-1 block text-sm text-slate-600">{module.level ?? 'Chưa có level'} · {module.skill ?? 'Chưa có skill'} · v{String(module.content.content_version ?? '?')}</span>
            <span className="mt-2 block text-xs font-semibold">{module.is_published ? 'Published' : 'Draft'}</span>
          </button>)}
        </section>
        {selected && <section className="space-y-5 rounded-xl bg-white p-5 ring-1 ring-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-master">{selected.title}</h2>
            <p className="text-sm text-slate-600">Phiên bản {String(selected.content.content_version ?? '?')} · {selected.is_published ? 'Published' : 'Draft'} · {selected.estimated_minutes ?? '?'} phút</p>
            <p className="mt-2 text-sm">{manifest?.outcome ?? 'Chưa có learning objective được xác minh trong ứng dụng cho phiên bản này.'}</p>
          </div>
          <div>
            <h3 className="font-semibold">Điều kiện Publish</h3>
            {selected.is_published ? <p className="mt-1 text-sm text-amber-800">Phiên bản đã Published và bất biến. Trạng thái database không xác nhận các tài nguyên nguồn đã đầy đủ; cần rà soát các mục bên dưới trước khi giao học viên thật.</p> : null}
            {gates.length > 0 &&
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-800">{gates.map((reason) => <li key={reason}>{reason}</li>)}</ul>}
            {!selected.is_published && <p className="mt-2 text-xs text-slate-500">Publish bị khóa cho đến khi đủ nguồn, khóa đáp án riêng và kiểm thử. Không đổi trạng thái chỉ bằng kiểm tra phía trình duyệt.</p>}
          </div>
          {manifest && <div>
            <h3 className="font-semibold">Xem trước sáu giai đoạn</h3>
            <ol className="mt-2 space-y-2">{STAGES.map((stage) => <li key={stage} className="rounded-lg border border-slate-200 p-3 text-sm">
              <strong>{stage}</strong> · {manifest.stageMinutes[stage]} phút
              <p className="mt-1 text-slate-600">{{ Discover: manifest.discoverPrompt, Learn: manifest.learn.introduction[0], Practice: `${manifest.practice.mcq.questions.length} MCQ và bài matching`, Apply: `${manifest.apply.prompts.length} bài ghi âm riêng`, Reflect: `${manifest.reflect.items.length} mục tự đánh giá`, Verify: manifest.verify.prompt }[stage]}</p>
            </li>)}</ol>
            <p className="mt-3 text-sm text-amber-800">Thiếu tài nguyên: {manifest.missingAssets.map((asset) => asset.description).join('; ')}</p>
          </div>}
        </section>}
      </div>}
  </div>;
}
