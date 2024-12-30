'use client';

import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";

export default function ChatRoomHome() {
  const router = useRouter();

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Liste des conversations (même composant que dans [expertId]/page.tsx) */}
      <div className="w-full md:w-80 border-r bg-gray-50 dark:bg-gray-900">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Messages</h2>
        </div>
        <div className="overflow-y-auto h-[calc(100vh-8rem)]">
          {/* La liste des conversations sera chargée ici */}
        </div>
      </div>

      {/* Zone de bienvenue (visible uniquement sur desktop) */}
      <div className="hidden md:flex flex-1 items-center justify-center">
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
    </div>
  );
}