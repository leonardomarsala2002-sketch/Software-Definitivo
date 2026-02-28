import { useState, useRef, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  MessageSquare, Send, Plus, Search, ArrowLeft, User,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useConversations,
  useMessages,
  useSendMessage,
  useMarkAsRead,
  useStartConversation,
  useContacts,
  type Conversation,
} from "@/hooks/useMessages";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function getInitials(name: string | null | undefined, email: string | null | undefined) {
  if (name) return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  if (email) return email.slice(0, 2).toUpperCase();
  return "??";
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Ieri";
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" });
}

const ROLE_BADGE: Record<string, { label: string; className: string }> = {
  super_admin: { label: "S.Admin", className: "bg-primary/15 text-primary" },
  admin: { label: "Admin", className: "bg-primary/15 text-primary" },
  employee: { label: "Dipendente", className: "bg-secondary text-muted-foreground" },
};

export default function Messages() {
  const { user } = useAuth();
  const { data: conversations = [], isLoading: convLoading } = useConversations();
  const { data: contacts = [] } = useContacts();
  const sendMessage = useSendMessage();
  const markAsRead = useMarkAsRead();
  const startConversation = useStartConversation();

  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading: msgLoading } = useMessages(activeConvId);

  const activeConv = conversations.find((c) => c.id === activeConvId);

  // Mark as read when opening conversation
  useEffect(() => {
    if (activeConvId && activeConv?.unread_count) {
      markAsRead.mutate(activeConvId);
    }
  }, [activeConvId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!messageText.trim() || !activeConvId) return;
    try {
      await sendMessage.mutateAsync({ conversationId: activeConvId, content: messageText.trim() });
      setMessageText("");
    } catch {
      toast.error("Errore nell'invio del messaggio");
    }
  };

  const handleStartChat = async (contactId: string) => {
    try {
      const convId = await startConversation.mutateAsync(contactId);
      setActiveConvId(convId);
      setShowNewChat(false);
      setContactSearch("");
      setMobileShowChat(true);
    } catch {
      toast.error("Errore nell'avvio della conversazione");
    }
  };

  const filteredContacts = useMemo(() => {
    if (!contactSearch.trim()) return contacts;
    const q = contactSearch.toLowerCase();
    return contacts.filter(
      (c) =>
        c.full_name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q)
    );
  }, [contacts, contactSearch]);

  const totalUnread = conversations.reduce((s, c) => s + c.unread_count, 0);

  /* ── Conversation List ── */
  const ConversationList = (
    <div className="flex flex-col h-full">
      <div className="p-4 pb-3 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold">Messaggi</h2>
          {totalUnread > 0 && (
            <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0 h-5 border-0">
              {totalUnread}
            </Badge>
          )}
        </div>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setShowNewChat(true)}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {showNewChat ? (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="p-3 border-b border-border">
            <div className="flex items-center gap-2 mb-2">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setShowNewChat(false); setContactSearch(""); }}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium">Nuova conversazione</span>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Cerca contatto..."
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-1">
              {filteredContacts.map((c) => {
                const badge = ROLE_BADGE[c.role ?? ""] ?? ROLE_BADGE.employee;
                return (
                  <button
                    key={c.id}
                    onClick={() => handleStartChat(c.id)}
                    disabled={startConversation.isPending}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-accent transition-colors text-left"
                  >
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarFallback className="text-xs bg-secondary">
                        {getInitials(c.full_name, c.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{c.full_name || c.email}</p>
                      <div className="flex items-center gap-1.5">
                        <Badge className={`text-[9px] px-1 py-0 h-4 border-0 ${badge.className}`}>
                          {badge.label}
                        </Badge>
                        {c.department && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                            {c.department === "sala" ? "Sala" : "Cucina"}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
              {filteredContacts.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">Nessun contatto trovato</p>
              )}
            </div>
          </ScrollArea>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="p-1">
            {convLoading ? (
              <p className="text-xs text-muted-foreground text-center py-8">Caricamento...</p>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <MessageSquare className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground mb-2">Nessuna conversazione</p>
                <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => setShowNewChat(true)}>
                  <Plus className="h-3.5 w-3.5" /> Nuova conversazione
                </Button>
              </div>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => {
                    setActiveConvId(conv.id);
                    setMobileShowChat(true);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors text-left",
                    activeConvId === conv.id
                      ? "bg-primary/10"
                      : "hover:bg-accent"
                  )}
                >
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback className="text-xs bg-secondary">
                      {getInitials(conv.other_user?.full_name, conv.other_user?.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">
                        {conv.other_user?.full_name || conv.other_user?.email || "Utente"}
                      </p>
                      {conv.last_message && (
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {formatTime(conv.last_message.created_at)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground truncate">
                        {conv.last_message
                          ? `${conv.last_message.sender_id === user?.id ? "Tu: " : ""}${conv.last_message.content.slice(0, 50)}`
                          : "Nessun messaggio"}
                      </p>
                      {conv.unread_count > 0 && (
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );

  /* ── Chat View ── */
  const ChatView = (
    <div className="flex flex-col h-full">
      {activeConv ? (
        <>
          {/* Header */}
          <div className="p-4 border-b border-border flex items-center gap-3">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 md:hidden"
              onClick={() => setMobileShowChat(false)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarFallback className="text-xs bg-secondary">
                {getInitials(activeConv.other_user?.full_name, activeConv.other_user?.email)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">
                {activeConv.other_user?.full_name || activeConv.other_user?.email || "Utente"}
              </p>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            {msgLoading ? (
              <p className="text-xs text-muted-foreground text-center py-8">Caricamento...</p>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <MessageSquare className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">Inizia la conversazione</p>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg) => {
                  const isMine = msg.sender_id === user?.id;
                  return (
                    <div key={msg.id} className={cn("flex", isMine ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[75%] rounded-2xl px-3.5 py-2.5",
                          isMine
                            ? "bg-primary text-primary-foreground rounded-br-md"
                            : "bg-secondary text-foreground rounded-bl-md"
                        )}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                        <p className={cn(
                          "text-[10px] mt-1",
                          isMine ? "text-primary-foreground/60" : "text-muted-foreground"
                        )}>
                          {new Date(msg.created_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          {/* Input */}
          <div className="p-3 border-t border-border">
            <form
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              className="flex items-center gap-2"
            >
              <Input
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Scrivi un messaggio..."
                className="flex-1 h-10"
                maxLength={2000}
              />
              <Button
                type="submit"
                size="icon"
                className="h-10 w-10 shrink-0"
                disabled={!messageText.trim() || sendMessage.isPending}
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
            <MessageSquare className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-base font-semibold mb-1">Messaggi</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Seleziona una conversazione o avviane una nuova
          </p>
          <Button size="sm" className="gap-1.5" onClick={() => setShowNewChat(true)}>
            <Plus className="h-3.5 w-3.5" /> Nuova conversazione
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="h-full flex gap-0 overflow-hidden">
      {/* Desktop: side-by-side */}
      <div className={cn(
        "w-full md:w-[340px] md:border-r md:border-border flex-shrink-0 bg-card/50 h-full",
        mobileShowChat ? "hidden md:flex md:flex-col" : "flex flex-col"
      )}>
        {ConversationList}
      </div>
      <div className={cn(
        "flex-1 h-full bg-background",
        !mobileShowChat ? "hidden md:flex md:flex-col" : "flex flex-col"
      )}>
        {ChatView}
      </div>
    </div>
  );
}
