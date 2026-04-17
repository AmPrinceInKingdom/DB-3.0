import { UsersManager } from "@/components/admin/users-manager";

export default function AdminUsersPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Users Management</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Search accounts, update user roles, and control account status access.
        </p>
      </header>
      <UsersManager />
    </div>
  );
}
