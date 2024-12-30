import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Expert, Location } from "@/types"; // Ajustez le chemin selon votre structure
import { Dispatch, SetStateAction } from 'react'; // Ajout de l'import

interface Expertise {
  id: string;
  name: string;
}

interface FilterModalProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  selectedPays: string;
  setSelectedPays: (pays: string) => void;
  selectedVille: string;
  setSelectedVille: (ville: string) => void;
  selectedExpertises: string[];
  setSelectedExpertises: Dispatch<SetStateAction<string[]>>; // Correction du type
  locations: Location[];
  experts: Expert[] | null;
}

export const FilterModal = ({
  open,
  setOpen,
  selectedPays,
  setSelectedPays,
  selectedVille,
  setSelectedVille,
  selectedExpertises,
  setSelectedExpertises,
  locations,
  experts,
}: FilterModalProps) => {
  const activeFiltersCount = [
    ...(selectedExpertises.length > 0 ? [1] : []),
    selectedPays,
    selectedVille
  ].filter(Boolean).length;

  const expertises: Expertise[] = [
    { id: 'immobilier', name: 'Immobilier' },
    { id: 'finance', name: 'Finance' },
    { id: 'droit', name: 'Droit' },
    { id: 'fiscalite', name: 'Fiscalité' },
    { id: 'assurance', name: 'Assurance' },
    { id: 'patrimoine', name: 'Patrimoine' },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90vh] h-[90vh] sm:h-auto sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex justify-between">
            Filtres
            <span className="text-sm text-muted-foreground">
              {activeFiltersCount} filtre{activeFiltersCount > 1 ? 's' : ''} actif{activeFiltersCount > 1 ? 's' : ''}
            </span>
          </DialogTitle>
          <DialogDescription>
            Filtrez les experts par expertise et localisation
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Section Expertises */}
          <div>
            <h3 className="font-medium mb-3">Expertises</h3>
            <div className="flex flex-wrap gap-2">
              {expertises.map((expertise) => (
                <button
                  key={expertise.id}
                  onClick={() => setSelectedExpertises(prev =>
                    prev.includes(expertise.id)
                      ? prev.filter(id => id !== expertise.id)
                      : [...prev, expertise.id]
                  )}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors
                    ${selectedExpertises.includes(expertise.id)
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                >
                  {expertise.name}
                </button>
              ))}
            </div>
          </div>

          {/* Section Pays */}
          <div>
            <h3 className="font-medium mb-3">Pays</h3>
            <div className="flex flex-wrap gap-2">
              {locations.map(({ pays }) => (
                <button
                  key={pays}
                  onClick={() => setSelectedPays(selectedPays === pays ? '' : pays)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors
                    ${selectedPays === pays
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                >
                  {pays}
                </button>
              ))}
            </div>
          </div>

          {/* Section Villes (conditionnelle) */}
          {selectedPays && (
            <div>
              <h3 className="font-medium mb-3">Villes {selectedPays && `(${selectedPays})`}</h3>
              <div className="flex flex-wrap gap-2">
                {locations
                  .find(loc => loc.pays === selectedPays)
                  ?.villes.map(ville => (
                    <button
                      key={ville}
                      onClick={() => setSelectedVille(selectedVille === ville ? '' : ville)}
                      className={`px-3 py-1.5 rounded-full text-sm transition-colors
                        ${selectedVille === ville
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                    >
                      {ville}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 pt-4 flex gap-4 border-t mt-auto">
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={() => {
              setSelectedPays('');
              setSelectedVille('');
              setSelectedExpertises([]);
            }}
          >
            Réinitialiser
          </Button>
          <Button 
            className="flex-1"
            onClick={() => setOpen(false)}
          >
            Appliquer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}; 