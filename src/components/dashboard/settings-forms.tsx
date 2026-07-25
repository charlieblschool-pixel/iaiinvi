"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Card } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function OrganizationNameForm({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    const res = await fetch("/api/settings/organization", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      setStatus("saved");
      router.refresh();
      setTimeout(() => setStatus("idle"), 2000);
    } else {
      setStatus("idle");
    }
  }

  return (
    <Card className="p-6">
      <h2 className="font-semibold">Workspace name</h2>
      <form onSubmit={handleSubmit} className="mt-4 flex items-end gap-3">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="orgName">Name</Label>
          <Input
            id="orgName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <Button type="submit" disabled={status === "saving"}>
          {status === "saved" ? "Saved" : status === "saving" ? "Saving…" : "Save"}
        </Button>
      </form>
    </Card>
  );
}

export function NewVendorForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [leadTimeDays, setLeadTimeDays] = useState("7");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/vendors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, leadTimeDays }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn't add that vendor.");
      return;
    }
    setName("");
    setLeadTimeDays("7");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-3">
      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor="vendorName">Vendor name</Label>
        <Input
          id="vendorName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Salon Supply Co."
          required
        />
      </div>
      <div className="flex w-40 flex-col gap-1.5">
        <Label htmlFor="leadTimeDays">Lead time (days)</Label>
        <Input
          id="leadTimeDays"
          type="number"
          min={1}
          value={leadTimeDays}
          onChange={(e) => setLeadTimeDays(e.target.value)}
          required
        />
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? "Adding…" : "Add vendor"}
      </Button>
      {error && <p className="text-sm text-status-bad">{error}</p>}
    </form>
  );
}

export function NewCategoryForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn't add that category.");
      return;
    }
    setName("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-3">
      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor="categoryName">Category name</Label>
        <Input
          id="categoryName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Retail hair care"
          required
        />
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? "Adding…" : "Add category"}
      </Button>
      {error && <p className="text-sm text-status-bad">{error}</p>}
    </form>
  );
}

type StaffMember = {
  membershipId: string;
  userId: string;
  name: string | null;
  email: string;
  role: "OWNER" | "ADMIN" | "STAFF";
};

export function StaffCard({
  members,
  currentUserId,
  isOwner,
}: {
  members: StaffMember[];
  currentUserId: string;
  isOwner: boolean;
}) {
  return (
    <Card className="p-6">
      <h2 className="font-semibold">Staff logins</h2>
      <p className="mt-1 text-sm text-foreground-muted">
        Everyone on this workspace signs in with their own email and
        password.
      </p>

      <ul className="mt-4 flex flex-col gap-2 text-sm">
        {members.map((m) => (
          <StaffRow
            key={m.membershipId}
            member={m}
            isSelf={m.userId === currentUserId}
            isOwner={isOwner}
          />
        ))}
      </ul>

      {isOwner && (
        <div className="mt-5 border-t border-border-hairline pt-5">
          <AddStaffForm />
        </div>
      )}
    </Card>
  );
}

function roleLabel(role: StaffMember["role"]) {
  if (role === "OWNER") return "Owner";
  if (role === "ADMIN") return "Admin";
  return "Staff";
}

function StaffRow({
  member,
  isSelf,
  isOwner,
}: {
  member: StaffMember;
  isSelf: boolean;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState(member.role);

  async function changeRole(newRole: "ADMIN" | "STAFF") {
    setLoading(true);
    const res = await fetch(`/api/settings/staff/${member.membershipId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    setLoading(false);
    if (res.ok) {
      setRole(newRole);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Couldn't change that role.");
    }
  }

  async function remove() {
    if (!confirm(`Remove ${member.name ?? member.email} from this workspace?`)) return;
    setLoading(true);
    const res = await fetch(`/api/settings/staff/${member.membershipId}`, {
      method: "DELETE",
    });
    setLoading(false);
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Couldn't remove that person.");
    }
  }

  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-border-hairline px-4 py-2.5">
      <div className="min-w-0">
        <p className="truncate">
          {member.name ?? member.email} {isSelf && <span className="text-foreground-muted">(you)</span>}
        </p>
        <p className="truncate text-xs text-foreground-muted">{member.email}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {isOwner && member.role !== "OWNER" ? (
          <>
            <Select
              className="h-9 w-28"
              value={role}
              disabled={loading}
              onChange={(e) => changeRole(e.target.value as "ADMIN" | "STAFF")}
            >
              <option value="STAFF">Staff</option>
              <option value="ADMIN">Admin</option>
            </Select>
            <Button variant="danger" disabled={loading} onClick={remove}>
              Remove
            </Button>
          </>
        ) : (
          <Badge tone={member.role === "OWNER" ? "good" : "neutral"}>
            {roleLabel(member.role)}
          </Badge>
        )}
      </div>
    </li>
  );
}

export function AddStaffForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"ADMIN" | "STAFF">("STAFF");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/settings/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn't add that login.");
      return;
    }
    setName("");
    setEmail("");
    setPassword("");
    setRole("STAFF");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <p className="text-xs font-medium uppercase tracking-wider text-foreground-muted">
        Add a staff login
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[160px] flex-1 flex-col gap-1.5">
          <Label htmlFor="staffName">Name</Label>
          <Input id="staffName" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
          <Label htmlFor="staffEmail">Email</Label>
          <Input
            id="staffEmail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="flex min-w-[160px] flex-1 flex-col gap-1.5">
          <Label htmlFor="staffPassword">Password</Label>
          <Input
            id="staffPassword"
            type="password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div className="flex w-28 flex-col gap-1.5">
          <Label htmlFor="staffRole">Role</Label>
          <Select
            id="staffRole"
            value={role}
            onChange={(e) => setRole(e.target.value as "ADMIN" | "STAFF")}
          >
            <option value="STAFF">Staff</option>
            <option value="ADMIN">Admin</option>
          </Select>
        </div>
        <Button type="submit" disabled={loading}>
          {loading ? "Adding…" : "Add login"}
        </Button>
      </div>
      {error && <p className="text-sm text-status-bad">{error}</p>}
    </form>
  );
}

export function DeleteWorkspaceButton() {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    const res = await fetch("/api/settings/delete-workspace", { method: "POST" });
    if (res.ok) {
      await signOut({ callbackUrl: "/" });
    } else {
      setLoading(false);
    }
  }

  if (!confirming) {
    return (
      <Button variant="danger" onClick={() => setConfirming(true)}>
        Delete workspace
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <p className="text-sm text-status-bad">
        This permanently deletes all products, stock, and history. Are you sure?
      </p>
      <Button variant="danger" disabled={loading} onClick={handleDelete}>
        {loading ? "Deleting…" : "Yes, delete everything"}
      </Button>
      <Button variant="secondary" onClick={() => setConfirming(false)}>
        Cancel
      </Button>
    </div>
  );
}
