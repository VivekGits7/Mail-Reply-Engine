import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Eye, Save } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { Field } from '@/components/common/Field';
import { PageHeader } from '@/components/common/PageHeader';
import { BlockSkeleton, EmptyState, ErrorState } from '@/components/common/QueryState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { selectIsAdmin } from '@/redux/authSlice';
import { useAppSelector } from '@/redux/hooks';
import { getErrorMessage, getErrorStatus } from '@/utils/apiError';
import { showToast } from '@/utils/toast';
import type { PreviewData, TemplateData } from '@/types';
import { adminApi, adminKeys, templateQuery } from './Adminapi';

export default function TemplateEditor() {
  const { templateKey = '' } = useParams();
  const template = useQuery(templateQuery(templateKey));
  if (template.isPending) return <BlockSkeleton />;
  if (template.isError && getErrorStatus(template.error) !== 404) {
    return <ErrorState error={template.error} onRetry={() => template.refetch()} />;
  }
  if (!template.data) {
    return (
      <EmptyState
        title="Template not found"
        description="The link may be old, or the template key changed."
        action={
          <Button asChild variant="outline">
            <Link to="/#admin-templates">Back to email templates</Link>
          </Button>
        }
      />
    );
  }
  return <Editor key={templateKey} template={template.data} />;
}

function Editor({ template }: { template: TemplateData }) {
  const isAdmin = useAppSelector(selectIsAdmin);
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body_html);
  const [active, setActive] = useState(template.is_active);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const cache = useQueryClient();
  const hasUnsavedChanges =
    subject !== template.subject || body !== template.body_html || active !== template.is_active;
  const save = useMutation({
    mutationFn: () =>
      adminApi.updateTemplate(template.template_key, {
        subject: subject.trim(),
        body_html: body,
        is_active: active,
      }),
    onSuccess: () => {
      cache.invalidateQueries({ queryKey: adminKeys.all });
      setPreview(null);
      showToast.success('Template saved');
    },
    onError: (error) => showToast.error(getErrorMessage(error)),
  });
  const render = useMutation({
    mutationFn: () => adminApi.previewTemplate(template.template_key, values),
    onSuccess: setPreview,
    onError: (error) => showToast.error(getErrorMessage(error)),
  });
  return (
    <section>
      <Link
        to="/#admin-templates"
        className="mb-4 inline-flex h-9 items-center gap-1.5 pill px-3.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Email templates
      </Link>
      <PageHeader
        title={template.name}
        description={<span className="font-mono">{template.template_key}</span>}
        actions={
          isAdmin && (
            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending || !hasUnsavedChanges || !subject.trim() || !body.trim()}
            >
              <Save className="size-4" /> {save.isPending ? 'Saving…' : 'Save template'}
            </Button>
          )
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-4">
          <Field id="template-subject" label="Subject">
            <Input
              id="template-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              readOnly={!isAdmin}
            />
          </Field>
          <Field id="template-body" label="HTML body">
            <Textarea
              id="template-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              readOnly={!isAdmin}
              rows={18}
              className="font-mono text-sm"
            />
          </Field>
          {isAdmin && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />{' '}
              Active template
            </label>
          )}
        </div>
        <aside className="space-y-4">
          <div className="panel p-5 sm:p-6">
            <h2 className="text-lg font-normal tracking-tight">Placeholders</h2>
            <p className="my-2 text-xs text-muted-foreground">
              Enter sample values and save edits before previewing.
            </p>
            <div className="space-y-3">
              {template.placeholders.map((key) => (
                <Field key={key} id={`placeholder-${key}`} label={key}>
                  <Input
                    id={`placeholder-${key}`}
                    value={values[key] ?? ''}
                    onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
                  />
                </Field>
              ))}
            </div>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => render.mutate()}
              disabled={render.isPending || hasUnsavedChanges}
            >
              <Eye className="size-4" /> {render.isPending ? 'Previewing…' : 'Preview'}
            </Button>
          </div>
          {preview && (
            <div className="panel p-5 sm:p-6">
              <h2 className="mb-2 text-lg font-normal tracking-tight">Rendered preview</h2>
              <p className="mb-2 text-sm font-medium break-words">{preview.subject}</p>
              <iframe
                title="Email preview"
                sandbox=""
                className="h-64 w-full rounded border bg-white"
                srcDoc={`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">${preview.body_html}`}
              />
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
