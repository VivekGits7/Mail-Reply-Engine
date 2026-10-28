import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, Plus, UserCheck, UserX } from 'lucide-react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { Field } from '@/components/common/Field';
import { FilterBar } from '@/components/common/FilterBar';
import { FilterSelect } from '@/components/common/FilterSelect';
import { PageHeader } from '@/components/common/PageHeader';
import { Pagination } from '@/components/common/Pagination';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/common/QueryState';
import { SearchInput } from '@/components/common/SearchInput';
import { SortSelect } from '@/components/common/SortSelect';
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
import { fieldProps } from '@/utils/fieldProps';
import { useUrlState } from '@/hooks/useUrlState';
import { getErrorMessage } from '@/utils/apiError';
import { applyServerErrors } from '@/utils/formErrors';
import { showToast } from '@/utils/toast';
import { formatDate } from '@/utils/utility';
import {
  UserRole,
  type CreateUserRequest,
  type UserData,
  type UserRole as Role,
  type UserSortBy,
  type SortOrder,
} from '@/types';
import { Avatar } from '@/components/visual/Avatar';
import { PhotoPicker } from '@/components/upload/PhotoPicker';
import { NO_PHOTO_CHANGE, isPhotoChanged, resolvePhoto } from '@/components/upload/Uploadapi';
import { Breakdown, MiniStat } from '@/components/visual/Breakdown';
import { SelectField } from '@/components/common/SelectField';
import { userKeys, userListQuery, usersApi } from './Usersapi';

function UserStats({ role, onRole }: { role?: string; onRole: (role: string | undefined) => void }) {
  const admins = useQuery(userListQuery({ role: UserRole.HR_ADMIN, limit: 1, offset: 0 }));
  const viewers = useQuery(userListQuery({ role: UserRole.HR_VIEWER, limit: 1, offset: 0 }));
  const active = useQuery(userListQuery({ is_active: true, limit: 1, offset: 0 }));
  const inactive = useQuery(userListQuery({ is_active: false, limit: 1, offset: 0 }));
  return (
    <Breakdown
      title="Users by role"
      totalLabel="People with access"
      loading={admins.isPending || viewers.isPending}
      segments={[
        { key: UserRole.HR_ADMIN, label: 'HR admins', tone: 'iris', value: admins.data?.total ?? 0 },
        { key: UserRole.HR_VIEWER, label: 'HR viewers', tone: 'azure', value: viewers.data?.total ?? 0 },
      ]}
      active={role}
      onSelect={onRole}
      aside={
        <>
          <MiniStat
            label="Active"
            icon={UserCheck}
            tone="mint"
            value={active.data?.total}
            loading={active.isPending}
          />
          <MiniStat
            label="Deactivated"
            icon={UserX}
            tone="neutral"
            value={inactive.data?.total}
            loading={inactive.isPending}
          />
        </>
      }
    />
  );
}

export default function Users() {
  const { get, set, page } = useUrlState();
  const params = {
    ...page,
    search: get('search'),
    role: get('role') as Role | undefined,
    is_active: get('is_active') === undefined ? undefined : get('is_active') === 'true',
    sort_by: (get('sort_by') ?? 'created_at') as UserSortBy,
    sort_order: (get('sort_order') ?? 'latest') as SortOrder,
  };
  const users = useQuery(userListQuery(params));
  return (
    <section>
      <PageHeader
        title="Users"
        description="Who can sign in to this dashboard. Viewers can see cases and settings, admins can also change them, and complaints access is granted to each person separately."
        actions={
          <UserForm
            trigger={
              <Button>
                <Plus className="size-4" /> Add user
              </Button>
            }
          />
        }
      />
      <UserStats role={params.role} onRole={(role) => set({ role })} />
      <FilterBar>
        <SearchInput label="Search users" value={params.search} onSearch={(search) => set({ search })} />
        <FilterSelect
          label="Role"
          value={params.role}
          options={Object.values(UserRole).map((value) => ({
            value,
            label: value === UserRole.HR_ADMIN ? 'HR admin' : 'HR viewer',
          }))}
          onChange={(role) => set({ role })}
        />
        <FilterSelect
          label="State"
          value={get('is_active')}
          options={[
            { value: 'true', label: 'Active' },
            { value: 'false', label: 'Inactive' },
          ]}
          onChange={(is_active) => set({ is_active })}
        />
        <SortSelect
          options={[
            { label: 'Newest first', sort_by: 'created_at', sort_order: 'latest' },
            { label: 'Name A to Z', sort_by: 'name', sort_order: 'a_to_z' },
            { label: 'Last login', sort_by: 'last_login_at', sort_order: 'z_to_a' },
          ]}
          sortBy={params.sort_by}
          sortOrder={params.sort_order}
          onChange={(sort_by, sort_order) => set({ sort_by, sort_order })}
        />
      </FilterBar>
      {users.isPending ? (
        <TableSkeleton />
      ) : users.isError ? (
        <ErrorState error={users.error} onRetry={() => users.refetch()} />
      ) : !users.data.data.length ? (
        <EmptyState title="No users match" description="Try another search or role filter." />
      ) : (
        <>
          <TableShell>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Complaints</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Last login</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.data.data.map((user) => (
                  <TableRow key={user.user_id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar name={user.name} src={user.photo_url} size="md" />
                        <div className="min-w-0">
                          <span className="font-medium">{user.name}</span>
                          <span className="block text-xs text-muted-foreground">{user.email}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{user.role === UserRole.HR_ADMIN ? 'HR admin' : 'HR viewer'}</TableCell>
                    <TableCell>{user.complaints_access ? 'Allowed' : 'No access'}</TableCell>
                    <TableCell>
                      <StatusBadge value={user.is_active ? 'active' : 'inactive'} />
                    </TableCell>
                    <TableCell>{formatDate(user.last_login_at)}</TableCell>
                    <TableCell>
                      <UserForm
                        user={user}
                        trigger={
                          <Button variant="ghost" size="sm">
                            <Pencil className="size-4" /> Edit
                          </Button>
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableShell>
          <Pagination
            total={users.data.total}
            limit={page.limit}
            offset={page.offset}
            onChange={(offset) => set({ offset: String(offset) }, { keepPage: true })}
          />
        </>
      )}
    </section>
  );
}

function UserForm({ trigger, user }: { trigger: React.ReactNode; user?: UserData }) {
  const [open, setOpen] = useState(false);
  const [photo, setPhoto] = useState(NO_PHOTO_CHANGE);
  const cache = useQueryClient();
  const schema = z.object({
    name: z.string().trim().min(2, 'Enter at least two characters').max(255),
    email: z.email('Enter a valid email address'),
    password: z
      .string()
      .max(128)
      .refine(
        (value) => (user ? !value || value.length >= 8 : value.length >= 8),
        'Use at least eight characters',
      ),
    role: z.enum([UserRole.HR_ADMIN, UserRole.HR_VIEWER]),
    complaints_access: z.boolean(),
    is_active: z.boolean(),
  });
  type UserValues = z.infer<typeof schema>;
  const defaults: UserValues = {
    name: user?.name ?? '',
    email: user?.email ?? '',
    password: '',
    role: user?.role ?? UserRole.HR_VIEWER,
    complaints_access: user?.complaints_access ?? false,
    is_active: user?.is_active ?? true,
  };
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<UserValues>({ resolver: zodResolver(schema), defaultValues: defaults });
  const watchedName = useWatch({ control, name: 'name' });
  const save = useMutation({
    mutationFn: async (values: UserValues) => {
      const uploaded = await resolvePhoto(photo, 'user_photo');
      if (user) {
        return usersApi.update(user.user_id, {
          role: values.role,
          complaints_access: values.complaints_access,
          is_active: values.is_active,
          password: values.password || null,
          ...(isPhotoChanged(photo) && { photo: uploaded ?? null }),
        });
      }
      return usersApi.create({
        name: values.name,
        email: values.email,
        password: values.password,
        role: values.role,
        complaints_access: values.complaints_access,
        ...(uploaded && { photo: uploaded }),
      } satisfies CreateUserRequest);
    },
    onSuccess: () => {
      cache.invalidateQueries({ queryKey: userKeys.all });
      showToast.success(user ? 'User updated' : 'User created');
      setOpen(false);
    },
    onError: (error) => {
      if (!applyServerErrors(error, setError)) showToast.error(getErrorMessage(error));
    },
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          reset(defaults);
          setPhoto(NO_PHOTO_CHANGE);
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{user ? 'Edit user' : 'Add user'}</DialogTitle>
          <DialogDescription>
            {user
              ? 'Change role, access, password or photo.'
              : 'Create a dashboard login for an HR colleague.'}
          </DialogDescription>
        </DialogHeader>
        <form
          id="user-form"
          noValidate
          className="space-y-4"
          onSubmit={handleSubmit((values) => save.mutate(values))}
        >
          <PhotoPicker
            name={watchedName}
            purpose="user_photo"
            currentUrl={user?.photo_url}
            value={photo}
            onChange={setPhoto}
            disabled={save.isPending}
          />
          <Field id="user-name" label="Name" error={errors.name?.message}>
            <Input
              {...fieldProps('user-name', errors.name?.message)}
              readOnly={Boolean(user)}
              {...register('name')}
            />
          </Field>
          <Field id="user-email" label="Email" error={errors.email?.message}>
            <Input
              type="email"
              autoCapitalize="none"
              spellCheck={false}
              {...fieldProps('user-email', errors.email?.message)}
              readOnly={Boolean(user)}
              {...register('email')}
            />
          </Field>
          <Field
            id="user-password"
            label={user ? 'New password' : 'Password'}
            optional={Boolean(user)}
            error={errors.password?.message}
          >
            <Input
              type="password"
              autoComplete="new-password"
              {...fieldProps('user-password', errors.password?.message)}
              {...register('password')}
            />
          </Field>
          <Field id="user-role" label="Role" error={errors.role?.message}>
            <Controller
              control={control}
              name="role"
              render={({ field }) => (
                <SelectField
                  {...fieldProps('user-role', errors.role?.message)}
                  className="w-full sm:w-full"
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  options={[
                    { value: UserRole.HR_VIEWER, label: 'HR viewer' },
                    { value: UserRole.HR_ADMIN, label: 'HR admin' },
                  ]}
                />
              )}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register('complaints_access')} /> Complaints access
          </label>
          {user && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register('is_active')} /> Active account
            </label>
          )}
        </form>
        <DialogFooter>
          <Button form="user-form" type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save user'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
