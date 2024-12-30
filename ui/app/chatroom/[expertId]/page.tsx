'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { formatTimeDifference } from '@/lib/utils';
import Link from 'next/link';
import { Expert, Message } from '@/types';

interface Conversation {
  expert: Expert;
  lastMessage?: Message;
  unreadCount: number;
}

export default function ChatRoom() {
  const router = useRouter();
  const { expertId } = useParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentExpert, setCurrentExpert] = useState<Expert | null>(null);

  // Charger les conversations
  useEffect(() => {
    const loadConversations = async () => {
      const { data: messages, error } = await supabase
        .from('messages')
        .select('*, expert:experts(*)')
        .or('sender_id.eq.user_id,receiver_id.eq.user_id')
        .order('created_at', { ascending: false });

      if (error) {
        toast.error("Erreur lors du chargement des conversations");
        return;
      }

      // Grouper les messages par expert
      const conversationsMap = new Map<string, Conversation>();
      messages?.forEach(message => {
        const expertId = message.sender_id === 'user_id' ? message.receiver_id : message.sender_id;
        if (!conversationsMap.has(expertId)) {
          conversationsMap.set(expertId, {
            expert: message.expert,
            lastMessage: message,
            unreadCount: message.sender_id !== 'user_id' && !message.read ? 1 : 0
          });
        }
      });

      setConversations(Array.from(conversationsMap.values()));
    };

    loadConversations();
  }, []);

  // Charger les messages de la conversation courante
  useEffect(() => {
    if (!expertId) return;

    const loadMessages = async () => {
      const { data: expert, error: expertError } = await supabase
        .from('experts')
        .select('*')
        .eq('id_expert', expertId)
        .single();

      if (expertError) {
        toast.error("Erreur lors du chargement de l'expert");
        return;
      }

      setCurrentExpert(expert);

      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${expertId},receiver_id.eq.${expertId}`)
        .order('created_at', { ascending: true });

      if (messagesError) {
        toast.error("Erreur lors du chargement des messages");
        return;
      }

      setMessages(messages || []);
    };

    loadMessages();

    // Souscrire aux nouveaux messages
    const channel = supabase.channel('public:messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          setMessages(current => [...current, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [expertId]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !expertId) return;

    const { error } = await supabase
      .from('messages')
      .insert({
        content: newMessage,
        sender_id: 'user_id',
        receiver_id: expertId,
      });

    if (error) {
      toast.error("Erreur lors de l'envoi du message");
      return;
    }

    setNewMessage('');
  };

  const markAsRead = async (messageId: string) => {
    const { error } = await supabase
      .from('messages')
      .update({ read: true })
      .eq('id', messageId);

    if (error) {
      toast.error("Erreur lors de la mise à jour du message");
    }
  };

  // Utilisez markAsRead quand un message est affiché
  useEffect(() => {
    if (!messages.length) return;

    // Marquer les messages non lus comme lus
    messages
      .filter(msg => !msg.read && msg.sender_id !== 'user_id')
      .forEach(msg => markAsRead(msg.id));
  }, [messages]);

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Liste des conversations - cachée sur mobile si conversation active */}
      <div className={`
        ${expertId ? 'hidden md:block' : 'block'} 
        w-full md:w-80 border-r bg-gray-50 dark:bg-gray-900
      `}>
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Messages</h2>
        </div>
        <div className="overflow-y-auto h-[calc(100vh-8rem)]">
          {conversations.length > 0 ? (
            conversations.map((conversation) => (
              <Link
                key={conversation.expert.id_expert}
                href={`/chatroom/${conversation.expert.id_expert}`}
                className={`flex items-center p-4 hover:bg-gray-100 dark:hover:bg-gray-800 ${
                  expertId === conversation.expert.id_expert ? 'bg-gray-100 dark:bg-gray-800' : ''
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-gray-300 mr-4">
                  {(conversation.expert.avatar_url || conversation.expert.image_url) && (
                    <img
                      src={conversation.expert.avatar_url || conversation.expert.image_url}
                      alt={`${conversation.expert.prenom} ${conversation.expert.nom}`}
                      className="w-full h-full rounded-full object-cover"
                    />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-medium">
                    {conversation.expert.prenom} {conversation.expert.nom}
                  </h3>
                  {conversation.lastMessage && (
                    <p className="text-sm text-gray-500 truncate">
                      {conversation.lastMessage.content}
                    </p>
                  )}
                </div>
                {conversation.unreadCount > 0 && (
                  <div className="ml-2 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {conversation.unreadCount}
                  </div>
                )}
              </Link>
            ))
          ) : (
            <div className="p-4 text-center text-gray-500">
              Aucune conversation
            </div>
          )}
        </div>
      </div>

      {/* Zone de chat - plein écran sur mobile si conversation active */}
      <div className={`
        flex-1 flex flex-col
        ${!expertId ? 'hidden md:flex' : 'flex'}
      `}>
        {expertId && currentExpert ? (
          <>
            {/* En-tête avec bouton retour sur mobile */}
            <div className="p-4 border-b flex items-center">
              <button 
                onClick={() => router.push('/chatroom')}
                className="md:hidden mr-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="w-10 h-10 rounded-full bg-gray-300 mr-4">
                {currentExpert.avatar_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={currentExpert.avatar_url}
                    alt=""
                    className="w-full h-full rounded-full object-cover"
                  />
                )}
              </div>
              <h2 className="text-xl font-semibold">
                {currentExpert.prenom} {currentExpert.nom}
              </h2>
            </div>

            {/* Messages avec padding ajusté */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20 md:pb-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.sender_id === 'user_id' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg p-3 ${
                      message.sender_id === 'user_id'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  >
                    <div>{message.content}</div>
                    <div className="text-xs opacity-70 mt-1">
                      {formatTimeDifference(new Date(message.created_at), new Date())}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Formulaire d'envoi fixé en bas sur mobile */}
            <form onSubmit={sendMessage} className="p-4 border-t flex gap-2 bg-white dark:bg-gray-900 fixed md:relative bottom-0 left-0 right-0">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Écrivez votre message..."
                className="flex-1"
              />
              <Button type="submit">Envoyer</Button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="text-center">
              <h2 className="text-2xl font-semibold mb-4">
                Bienvenue dans votre messagerie
              </h2>
              <p className="text-gray-500 mb-8">
                Sélectionnez une conversation ou commencez à discuter avec un expert
              </p>
              <Button onClick={() => router.push('/discover')}>
                Trouver un expert
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 