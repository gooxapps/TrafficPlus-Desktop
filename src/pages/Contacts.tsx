import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { Users, Plus, Edit2, Trash2, Mail, Phone, User, Inbox } from "lucide-react";
import { timeAgo } from "@/lib/utils";
import { toast } from "@/hooks/useToast";
import { useSiteSettings } from '@/hooks/useSiteSettings';
import ComingSoon from '@/components/ui/ComingSoon';

interface Contact {
  id: string;
  userId: string;
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
  createdAt: string;
}

export default function Contacts() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", notes: "" });

  const electronAPI = (window as any).electronAPI;

  const { settings } = useSiteSettings();

  if (settings.featurePages && settings.featurePages.contacts === false) {
    return <ComingSoon />;
  }

  const fetchContacts = async () => {
    if (!user?.id || !electronAPI) return;
    try {
      const data = await electronAPI.contactsGet(user.id);
      setContacts(data);
    } catch (error) {
      console.error("Failed to fetch contacts:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!electronAPI) return;

    try {
      if (editingContact) {
        await electronAPI.contactsUpdate(editingContact.id, formData);
        setContacts((prev) => prev.map((c) => (c.id === editingContact.id ? { ...c, ...formData } : c)));
        toast({ title: "Contact updated", description: "Your contact has been updated successfully." });
      } else {
        const newContact = await electronAPI.contactsCreate(
          user.id,
          formData.name,
          formData.email || undefined,
          formData.phone || undefined,
          formData.notes || undefined
        );
        setContacts((prev) => [newContact, ...prev]);
        toast({ title: "Contact added", description: "Your contact has been added successfully." });
      }
      setIsAddDialogOpen(false);
      setFormData({ name: "", email: "", phone: "", notes: "" });
      setEditingContact(null);
    } catch (error) {
      console.error("Failed to save contact:", error);
      toast({ title: "Error", description: "Failed to save contact.", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!electronAPI) return;
    try {
      await electronAPI.contactsDelete(id);
      setContacts((prev) => prev.filter((c) => c.id !== id));
      toast({ title: "Contact deleted", description: "Your contact has been deleted successfully." });
    } catch (error) {
      console.error("Failed to delete contact:", error);
      toast({ title: "Error", description: "Failed to delete contact.", variant: "destructive" });
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [user?.id]);

  useEffect(() => {
    if (editingContact) {
      setFormData({
        name: editingContact.name,
        email: editingContact.email || "",
        phone: editingContact.phone || "",
        notes: editingContact.notes || "",
      });
    }
  }, [editingContact]);

  return (
    <DashboardLayout title="Contacts" subtitle="Manage your contacts">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Your contacts</CardTitle>
              <CardDescription>{contacts.length} contacts</CardDescription>
            </div>
            <Button onClick={() => { setEditingContact(null); setFormData({ name: "", email: "", phone: "", notes: "" }); setIsAddDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" /> Add contact
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground">Loading contacts...</p>
            </div>
          ) : contacts.length === 0 ? (
            <div className="py-12 text-center">
              <Inbox className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm font-medium">No contacts yet</p>
              <p className="text-xs text-muted-foreground mt-1">Add your first contact to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {contacts.map((contact) => (
                <div key={contact.id} className="flex items-center justify-between p-4 rounded-lg border border-border">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold">
                      {contact.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{contact.name}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        {contact.email && (
                          <div className="flex items-center gap-1">
                            <Mail className="w-3.5 h-3.5" />
                            {contact.email}
                          </div>
                        )}
                        {contact.phone && (
                          <div className="flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5" />
                            {contact.phone}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingContact(contact); setIsAddDialogOpen(true); }}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => handleDelete(contact.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editingContact ? "Edit contact" : "Add contact"}</DialogTitle>
              <DialogDescription>{editingContact ? "Update your contact details." : "Add a new contact to your list."}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Contact name"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Phone</label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+1 234 567 890"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Notes</label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Add notes about this contact"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
              <Button type="submit">{editingContact ? "Update" : "Add"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
