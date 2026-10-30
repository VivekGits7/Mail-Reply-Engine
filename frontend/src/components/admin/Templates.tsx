import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { Field } from '@/components/common/Field';
import { FilterBar } from '@/components/common/FilterBar';
import { FilterSelect } from '@/components/common/FilterSelect';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/common/QueryState';
import { SearchInput } from '@/components/common/SearchInput';
import { StatusBadge } from '@/components/common/StatusBadge';
import { TableShell } from '@/components/common/TableShell';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useLocalListState as useUrlState } from '@/hooks/useLocalListState';
import { selectIsAdmin } from '@/redux/authSlice';
import { useAppSelector } from '@/redux/hooks';
import { getErrorMessage } from '@/utils/apiError';
import { showToast } from '@/utils/toast';
import { formatDate } from '@/utils/utility';
import { adminApi, adminKeys, templatesQuery } from './Adminapi';

function slugify(str: string) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function NewTemplateDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [keyTouched, setKeyTouched] = useState(false);
  const [templateKey, setTemplateKey] = useState('');
  const navigate = useNavigate();
  const cache = useQueryClient();

  const autoKey = keyTouched ? templateKey : slugify(name);

  const create = useMutation({
    mutationFn: () =>
      adminApi.createTemplate({ template_key: autoKey, name: name.trim(), subject: subject.trim() }),
    onSuccess: (res) => {
      cache.invalidateQueries({ queryKey: adminKeys.all });
      showToast.success('Template created');
      setOpen(false);
      setName('');
      setSubject('');
      setTemplateKey('');
      setKeyTouched(false);
      navigate(`/admin/templates/${encodeURIComponent(res.data.template_key)}`);
    },
    onError: (err) => showToast.error(getErrorMessage(err)),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !subject.trim() || !autoKey) return;
    create.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button id="new-template-btn" size="sm">
          <Plus className="size-4" aria-hidden="true" />
          New template
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New email template</DialogTitle>
          <DialogDescription>
            Create a paused template, then add its body and activate it in the editor.
          </DialogDescription>
        </DialogHeader>
        <form id="new-template-form" noValidate onSubmit={handleSubmit} className="space-y-4 pt-1">
          <Field id="tpl-name" label="Template name" hint="E.g. Offer Letter, Day-1 Welcome">
            <Input
              id="tpl-name"
              placeholder="Offer Letter"
              value={name}
              maxLength={64}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </Field>
          <Field
            id="tpl-key"
            label="Template key"
            hint="Unique identifier used by the system. Auto-filled from the name."
          >
            <Input
              id="tpl-key"
              placeholder="offer_letter"
              value={autoKey}
              maxLength={64}
              onChange={(e) => {
                setKeyTouched(true);
                setTemplateKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''));
              }}
            />
          </Field>
          <Field id="tpl-subject" label="Email subject line" hint="Supports {{ company_name }} and {{ dashboard_link }}">
            <Input
              id="tpl-subject"
              placeholder="Welcome to {{ company_name }}!"
              value={subject}
              maxLength={200}
              onChange={(e) => setSubject(e.target.value)}
            />
          </Field>
        </form>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="new-template-form"
            disabled={create.isPending || !name.trim() || !subject.trim() || !autoKey}
          >
            {create.isPending ? 'Creating…' : 'Create template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Templates() {
  const isAdmin = useAppSelector(selectIsAdmin);
  const { get, set } = useUrlState();
  const params = {
    search: get('search'),
    is_active: get('is_active') === undefined ? undefined : get('is_active') === 'true',
  };
  const templates = useQuery(templatesQuery(params));

  return (
    <section>
      <PageHeader
        title="Email templates"
        actions={isAdmin && <NewTemplateDialog />}
      />
      <FilterBar>
        <SearchInput label="Search templates" value={params.search} onSearch={(search) => set({ search })} />
        <FilterSelect
          label="State"
          value={get('is_active')}
          options={[
            { value: 'true', label: 'Active' },
            { value: 'false', label: 'Paused' },
          ]}
          onChange={(is_active) => set({ is_active })}
        />
      </FilterBar>
      {templates.isPending ? (
        <TableSkeleton />
      ) : templates.isError ? (
        <ErrorState error={templates.error} onRetry={() => templates.refetch()} />
      ) : !templates.data.length ? (
        <EmptyState
          title={params.search || get('is_active') ? 'No templates match' : 'No templates yet'}
          description={
            params.search || get('is_active')
              ? 'Try another search or state filter.'
              : 'Templates are created when the server starts. If this stays empty, ask IT to check the backend.'
          }
        />
      ) : (
        <TableShell>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.data.map((item) => (
                <TableRow key={item.template_key}>
                  <TableCell>
                    <Link
                      to={`/admin/templates/${encodeURIComponent(item.template_key)}`}
                      className="font-medium hover:text-primary hover:underline"
                    >
                      {item.name}
                    </Link>
                    <span className="block font-mono text-xs text-muted-foreground">{item.template_key}</span>
                  </TableCell>
                  <TableCell className="max-w-sm whitespace-normal">{item.subject}</TableCell>
                  <TableCell>
                    <StatusBadge value={item.is_active ? 'active' : 'paused'} />
                  </TableCell>
                  <TableCell>{formatDate(item.updated_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableShell>
      )}
    </section>
  );
}
