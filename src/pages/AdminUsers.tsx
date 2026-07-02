import { useEffect, useMemo, useState } from 'react';
import { useStoredAsync } from '@/hooks/useStoredAsync';
import { getUsers, sendNotification, broadcastNotification } from '@/lib/storage';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/useToast';
import { useAuth } from '@/hooks/useAuth';

export default function AdminUsers() {
  const { user } = useAuth();
  const users = useStoredAsync(getUsers, [] as any[]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedNotificationUsers, setSelectedNotificationUsers] = useState<Set<string>>(new Set());
  const [role, setRole] = useState<string>('user');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState<'info' | 'success' | 'warning' | 'error'>('info');
  const [broadcast, setBroadcast] = useState(false);
  const [sendingNotification, setSendingNotification] = useState(false);

  useEffect(() => {
    if (!selectedUser) {
      setHistory([]);
      return;
    }

    const loadHistory = async () => {
      try {
        const electronAPI = (window as any).electronAPI;
        if (!electronAPI?.userHistory) return;
        const rows = await electronAPI.userHistory(selectedUser.id);
        setHistory(rows);
      } catch (err: any) {
        console.error('Failed to load user login history:', err);
      }
    };

    loadHistory();
  }, [selectedUser]);

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return users;
    return users.filter((userItem: any) =>
      userItem.name.toLowerCase().includes(normalized) ||
      (userItem.email || '').toLowerCase().includes(normalized) ||
      (userItem.phone || '').toLowerCase().includes(normalized) ||
      (userItem.role || '').toLowerCase().includes(normalized)
    );
  }, [query, users]);

  if (user?.role !== 'admin') {
    return (
      <DashboardLayout title="Admin Users">
        <Card className="p-8 text-center max-w-md mx-auto">
          <h3 className="font-semibold">Access denied</h3>
          <p className="text-sm text-muted-foreground mt-2">Only administrators can manage users.</p>
        </Card>
      </DashboardLayout>
    );
  }

  const handleSelect = (userItem: any) => {
    setSelectedUser(userItem);
    setName(userItem.name || '');
    setEmail(userItem.email || '');
    setPhone(userItem.phone || '');
    setRole(userItem.role || 'user');
  };

  const handleSave = async () => {
    if (!selectedUser) return;
    try {
      const electronAPI = (window as any).electronAPI;
      await electronAPI.userUpsert({
        id: selectedUser.id,
        name,
        email,
        phone,
        role,
      });
      toast({ title: 'User saved', variant: 'success' });
      setSelectedUser(null);
      setName('');
      setEmail('');
      setPhone('');
      setRole('user');
      window.dispatchEvent(new CustomEvent('data:changed'));
    } catch (err: any) {
      toast({ title: 'Save failed', description: err.message || 'Try again', variant: 'error' });
    }
  };

  const handleDelete = async () => {
    if (!selectedUser) return;
    try {
      const electronAPI = (window as any).electronAPI;
      await electronAPI.userDelete(selectedUser.id);
      toast({ title: 'User deleted', variant: 'success' });
      setSelectedUser(null);
      setName('');
      setEmail('');
      setPhone('');
      setRole('user');
      setHistory([]);
      window.dispatchEvent(new CustomEvent('data:changed'));
    } catch (err: any) {
      toast({ title: 'Delete failed', description: err.message || 'Try again', variant: 'error' });
    }
  };

  const handleSendNotification = async () => {
    if (!notificationTitle.trim() || !notificationMessage.trim()) {
      toast({ title: 'Missing fields', description: 'Please enter a title and a message.', variant: 'default' });
      return;
    }

    if (!broadcast && selectedNotificationUsers.size === 0 && !selectedUser) {
      toast({ title: 'Select users', description: 'Choose users to send this message to, or enable broadcast.', variant: 'default' });
      return;
    }

    setSendingNotification(true);
    try {
      if (broadcast) {
        await broadcastNotification(notificationType, notificationTitle.trim(), notificationMessage.trim());
      } else if (selectedNotificationUsers.size > 0) {
        // Send to multiple selected users
        for (const userId of selectedNotificationUsers) {
          await sendNotification(userId, notificationType, notificationTitle.trim(), notificationMessage.trim());
        }
      } else if (selectedUser) {
        // Fallback: send to the currently selected user
        await sendNotification(selectedUser.id, notificationType, notificationTitle.trim(), notificationMessage.trim());
      }
      toast({ 
        title: 'Message sent', 
        description: broadcast ? 'Sent to all users' : `Sent to ${selectedNotificationUsers.size || 1} user(s)`,
        variant: 'success' 
      });
      setNotificationTitle('');
      setNotificationMessage('');
    } catch (err: any) {
      toast({ title: 'Send failed', description: err?.message || 'Unable to send notification.', variant: 'error' });
    } finally {
      setSendingNotification(false);
    }
  };

  const toggleNotificationUserSelection = (userId: string) => {
    const newSet = new Set(selectedNotificationUsers);
    if (newSet.has(userId)) {
      newSet.delete(userId);
    } else {
      newSet.add(userId);
    }
    setSelectedNotificationUsers(newSet);
  };

  return (
    <DashboardLayout title="Admin Users" subtitle="View and manage every user account.">
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <CardTitle>Registered users</CardTitle>
                <CardDescription>See user login details, device, and location data.</CardDescription>
              </div>
              <div className="max-w-sm w-full">
                <Label>Search users</Label>
                <Input
                  placeholder="Search by name, email, phone or role"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">
                      <input 
                        type="checkbox" 
                        className="rounded"
                        checked={selectedNotificationUsers.size > 0 && selectedNotificationUsers.size === filteredUsers.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            const allIds = new Set(filteredUsers.map((u: any) => u.id));
                            setSelectedNotificationUsers(allIds);
                          } else {
                            setSelectedNotificationUsers(new Set());
                          }
                        }}
                        title="Select all visible users"
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email / Phone</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Last login</TableHead>
                    <TableHead>Device / Location</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((userItem: any) => (
                    <TableRow key={userItem.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell onClick={(e) => { e.stopPropagation(); toggleNotificationUserSelection(userItem.id); }}>
                        <input 
                          type="checkbox" 
                          className="rounded"
                          checked={selectedNotificationUsers.has(userItem.id)}
                          onChange={() => toggleNotificationUserSelection(userItem.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </TableCell>
                      <TableCell onClick={() => handleSelect(userItem)}>{userItem.name}</TableCell>
                      <TableCell onClick={() => handleSelect(userItem)}>
                        <div>{userItem.email || userItem.phone || '—'}</div>
                      </TableCell>
                      <TableCell onClick={() => handleSelect(userItem)}>{userItem.role}</TableCell>
                      <TableCell onClick={() => handleSelect(userItem)}>{userItem.lastLoginAt ? new Date(userItem.lastLoginAt).toLocaleString() : 'Never'}</TableCell>
                      <TableCell onClick={() => handleSelect(userItem)}>{userItem.lastDevice || '—'} · {userItem.lastLocation || 'Unknown'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{selectedUser ? 'Edit user' : 'Select a user'}</CardTitle>
            <CardDescription>Select a row to update user details or role.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <select className="input w-full" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="user">User</option>
                <option value="premium">Premium</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button onClick={handleSave} disabled={!selectedUser} className="w-full">
                Save user
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={!selectedUser} className="w-full">
                Delete user
              </Button>
            </div>

            <div className="rounded-xl border border-border p-4 bg-muted">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <p className="text-sm font-semibold">Send notification</p>
                  <p className="text-xs text-muted-foreground">
                    {broadcast 
                      ? 'Send a message to all users.'
                      : selectedNotificationUsers.size > 0 
                        ? `Selected: ${selectedNotificationUsers.size} user(s)`
                        : 'Check user(s) above or select one below, then send a message.'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={broadcast} onCheckedChange={setBroadcast} />
                  <span className="text-sm">Broadcast</span>
                </div>
              </div>
              <div className="space-y-3">
                {!broadcast && selectedNotificationUsers.size > 0 && (
                  <div className="rounded-lg border border-border bg-background p-3 max-h-24 overflow-y-auto">
                    <p className="text-xs font-semibold mb-2">Recipients:</p>
                    <div className="space-y-1">
                      {Array.from(selectedNotificationUsers).map(userId => {
                        const targetUser = users.find((u: any) => u.id === userId);
                        return (
                          <div key={userId} className="text-xs flex justify-between items-center">
                            <span>{targetUser?.name} ({targetUser?.email || 'no email'})</span>
                            <button 
                              onClick={() => toggleNotificationUserSelection(userId)}
                              className="text-muted-foreground hover:text-foreground text-lg leading-none"
                            >
                              ×
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="grid gap-3">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <select className="input w-full" value={notificationType} onChange={(e) => setNotificationType(e.target.value as any)}>
                      <option value="info">Info</option>
                      <option value="success">Success</option>
                      <option value="warning">Warning</option>
                      <option value="error">Error</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input value={notificationTitle} onChange={(e) => setNotificationTitle(e.target.value)} placeholder="Message title" />
                  </div>
                  <div className="space-y-2">
                    <Label>Message</Label>
                    <Textarea value={notificationMessage} onChange={(e) => setNotificationMessage(e.target.value)} placeholder="Message body" rows={4} />
                  </div>
                </div>
                <Button onClick={handleSendNotification} disabled={sendingNotification} className="w-full">
                  {broadcast 
                    ? 'Send to all users' 
                    : selectedNotificationUsers.size > 0
                      ? `Send to ${selectedNotificationUsers.size} user(s)`
                      : 'Send to selected user'}
                </Button>
              </div>
            </div>

            {selectedUser && (
              <div className="rounded-xl border border-border p-4 bg-muted">
                <p className="text-sm font-semibold mb-3">Recent login history</p>
                {history.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No login history is available for this user.</p>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {history.map((entry) => (
                      <div key={entry.id} className="rounded-xl border border-border bg-background p-3">
                        <p className="text-sm font-medium">
                          {entry.lastLoginAt ? new Date(entry.lastLoginAt).toLocaleString() : 'Login event'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {entry.lastDevice || 'Unknown device'} · {entry.lastLocation || 'Unknown location'}
                        </p>
                        <p className="text-xs text-muted-foreground">{entry.lastUserAgent || 'No user agent recorded'}</p>
                        <p className="text-xs text-muted-foreground">
                          {entry.lastCountry || '—'} / {entry.lastRegion || '—'} / {entry.lastCity || '—'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
