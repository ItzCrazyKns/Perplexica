'use client';

import { Search, Filter, X } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Button } from "@/components/ui/button";
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FilterModal } from "@/components/FilterModal";

interface Expert {
  id: number;
  id_expert: string;
  nom: string;
  prenom: string;
  adresse: string;
  pays: string;
  ville: string;
  expertises: string;
  biographie: string;
  tarif: number;
  services: any;
  created_at: string;
  image_url: string;
}

interface Location {
  pays: string;
  villes: string[];
}

interface Expertise {
  id: string;
  name: string;
}

const ExpertCard = ({ expert }: { expert: Expert }) => {
  const router = useRouter();

  const handleContact = async (e: React.MouseEvent) => {
    e.preventDefault(); // Empêche la navigation vers la page expert
    
    try {
      // Vérifier si une conversation existe déjà
      const { data: existingMessages } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.user_id,receiver_id.eq.${expert.id_expert}`)
        .limit(1);

      if (!existingMessages || existingMessages.length === 0) {
        // Si pas de conversation existante, créer le premier message
        const { error: messageError } = await supabase
          .from('messages')
          .insert({
            content: `Bonjour ${expert.prenom}, je souhaiterais échanger avec vous.`,
            sender_id: 'user_id', // À remplacer par l'ID de l'utilisateur connecté
            receiver_id: expert.id_expert,
            read: false
          });

        if (messageError) {
          throw messageError;
        }
      }

      // Rediriger vers la conversation
      router.push(`/chatroom/${expert.id_expert}`);
      toast.success(`Conversation ouverte avec ${expert.prenom} ${expert.nom}`);
    } catch (error) {
      console.error('Error starting conversation:', error);
      toast.error("Erreur lors de l'ouverture de la conversation");
    }
  };

  return (
    <Link
      href={`/expert/${expert.id_expert}`}
      key={expert.id}
      className="max-w-sm w-full rounded-lg overflow-hidden bg-light-secondary dark:bg-dark-secondary hover:-translate-y-[1px] transition duration-200"
    >
      <div className="relative w-full h-48">
        {expert.image_url ? (
          <Image
            src={expert.image_url}
            alt={`${expert.prenom} ${expert.nom}`}
            fill
            className="object-cover"
            onError={(e) => {
              // Fallback en cas d'erreur de chargement de l'image
              const target = e.target as HTMLImageElement;
              target.onerror = null;
              target.src = '/placeholder-image.jpg';
            }}
          />
        ) : (
          <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
            <span className="text-gray-400">Pas d&apos;image</span>
          </div>
        )}
      </div>

      <div className="px-6 py-4">
        <div className="font-bold text-lg mb-2">
          {expert.prenom} {expert.nom}
        </div>
        <div className="flex flex-col space-y-2">
          <p className="text-black/70 dark:text-white/70 text-sm">
            {expert.ville}, {expert.pays}
          </p>
          <p className="text-black/70 dark:text-white/70 text-sm">
            {expert.expertises}
          </p>
          {expert.tarif && (
            <p className="text-black/90 dark:text-white/90 font-medium">
              {expert.tarif}€ /heure
            </p>
          )}
          <Button 
            onClick={handleContact}
            className="mt-4"
            variant="outline"
          >
            Contacter
          </Button>
        </div>
      </div>
    </Link>
  );
};

const Page = () => {
  const [experts, setExperts] = useState<Expert[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPays, setSelectedPays] = useState('');
  const [selectedVille, setSelectedVille] = useState('');
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedExpertises, setSelectedExpertises] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  // Calcul du nombre de filtres actifs
  const activeFiltersCount = [
    ...(selectedExpertises.length > 0 ? [1] : []),
    selectedPays,
    selectedVille
  ].filter(Boolean).length;

  // Récupérer les experts avec filtres
  const fetchExperts = useCallback(async () => {
    try {
      let query = supabase
        .from('experts')
        .select('*');

      if (selectedExpertises.length > 0) {
        // Adaptez cette partie selon la structure de votre base de données
        query = query.contains('expertises', selectedExpertises);
      }

      // Filtre par pays
      if (selectedPays) {
        query = query.eq('pays', selectedPays);
      }

      // Filtre par ville
      if (selectedVille) {
        query = query.eq('ville', selectedVille);
      }

      const { data, error } = await query;
          
      if (error) throw error;
      setExperts(data);
    } catch (err: any) {
      console.error('Error fetching experts:', err.message);
      toast.error('Erreur lors du chargement des experts');
    } finally {
      setLoading(false);
    }
  }, [selectedPays, selectedVille, selectedExpertises]);

  // Récupérer la liste des pays et villes uniques
  const fetchLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('experts')
        .select('pays, ville');
      
      if (error) throw error;

      // Créer un objet avec pays et villes uniques
      const locationMap = new Map<string, Set<string>>();
      
      data.forEach(expert => {
        if (expert.pays) {
          if (!locationMap.has(expert.pays)) {
            locationMap.set(expert.pays, new Set());
          }
          if (expert.ville) {
            locationMap.get(expert.pays)?.add(expert.ville);
          }
        }
      });

      // Convertir en tableau trié
      const sortedLocations = Array.from(locationMap).map(([pays, villes]) => ({
        pays,
        villes: Array.from(villes).sort()
      })).sort((a, b) => a.pays.localeCompare(b.pays));

      setLocations(sortedLocations);
    } catch (err: any) {
      console.error('Error fetching locations:', err.message);
    }
  };

  // Reset ville quand le pays change
  useEffect(() => {
    setSelectedVille('');
  }, [selectedPays]);

  useEffect(() => {
    fetchExperts();
    fetchLocations();
  }, [fetchExperts]);

  return loading ? (
    <div className="flex flex-row items-center justify-center min-h-screen">
      <svg
        aria-hidden="true"
        className="w-8 h-8 text-light-200 fill-light-secondary dark:text-[#202020] animate-spin dark:fill-[#ffffff3b]"
        viewBox="0 0 100 101"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M100 50.5908C100.003 78.2051 78.1951 100.003 50.5908 100C22.9765 99.9972 0.997224 78.018 1 50.4037C1.00281 22.7993 22.8108 0.997224 50.4251 1C78.0395 1.00281 100.018 22.8108 100 50.4251ZM9.08164 50.594C9.06312 73.3997 27.7909 92.1272 50.5966 92.1457C73.4023 92.1642 92.1298 73.4365 92.1483 50.6308C92.1669 27.8251 73.4392 9.0973 50.6335 9.07878C27.8278 9.06026 9.10003 27.787 9.08164 50.594Z"
          fill="currentColor"
        />
        <path
          d="M93.9676 39.0409C96.393 38.4037 97.8624 35.9116 96.9801 33.5533C95.1945 28.8227 92.871 24.3692 90.0681 20.348C85.6237 14.1775 79.4473 9.36872 72.0454 6.45794C64.6435 3.54717 56.3134 2.65431 48.3133 3.89319C45.869 4.27179 44.3768 6.77534 45.014 9.20079C45.6512 11.6262 48.1343 13.0956 50.5786 12.717C56.5073 11.8281 62.5542 12.5399 68.0406 14.7911C73.527 17.0422 78.2187 20.7487 81.5841 25.4923C83.7976 28.5886 85.4467 32.059 86.4416 35.7474C87.1273 38.1189 89.5423 39.6781 91.9676 39.0409Z"
          fill="currentFill"
        />
      </svg>
    </div>
  ) : (
    <div className="pb-24 lg:pb-0">
      <div className="flex flex-col pt-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <div className="flex items-center">
              <Search />
              <h1 className="text-3xl font-medium p-2">Nos Experts</h1>
            </div>
            <div className="text-gray-500 ml-10">
              Plus de 300 experts à votre écoute
            </div>
          </div>
          
          {/* CTA Filtres unifié */}
          <Button 
            onClick={() => setOpen(true)}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Filter size={18} />
            <span>Filtrer</span>
            {activeFiltersCount > 0 && (
              <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">
                {activeFiltersCount}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Modale de filtres */}
      <FilterModal
        open={open}
        setOpen={setOpen}
        selectedPays={selectedPays}
        setSelectedPays={setSelectedPays}
        selectedVille={selectedVille}
        setSelectedVille={setSelectedVille}
        selectedExpertises={selectedExpertises}
        setSelectedExpertises={setSelectedExpertises}
        locations={locations}
        experts={experts}
      />

      <hr className="border-t border-[#2B2C2C] my-4 w-full" />

      <div className="grid lg:grid-cols-3 sm:grid-cols-2 grid-cols-1 gap-4 pb-28 lg:pb-8 w-full justify-items-center lg:justify-items-start">
        {experts && experts.length > 0 ? (
          experts.map((expert) => (
            <ExpertCard key={expert.id} expert={expert} />
          ))
        ) : (
          <p className="col-span-full text-center text-gray-500">
            Aucun expert trouvé
          </p>
        )}
      </div>
    </div>
  );
};

export default Page;
