interface Business {
  id: string;
  name: string;
  address: string;
  phone: string;
  website?: string;
  email?: string;
  description?: string;
  rating?: number;
}

interface SearchResultsProps {
  results: Business[];
  isLoading: boolean;
}

export function SearchResults({ results, isLoading }: SearchResultsProps) {
  if (isLoading) {
    return (
      <div className="w-full max-w-4xl mx-auto mt-8">
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-muted rounded-lg p-6">
              <div className="h-4 bg-muted-foreground/20 rounded w-3/4 mb-4"></div>
              <div className="h-3 bg-muted-foreground/20 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!results.length) {
    return null
  }

  return (
    <div className="w-full max-w-4xl mx-auto mt-8">
      <div className="space-y-4">
        {results.map((business) => (
          <div key={business.id} className="bg-card rounded-lg p-6 shadow-sm">
            <h3 className="text-xl font-semibold mb-2">{business.name}</h3>
            {business.address && (
              <p className="text-muted-foreground mb-2">{business.address}</p>
            )}
            <div className="flex flex-wrap gap-4 text-sm">
              {business.phone && (
                <a 
                  href={`tel:${business.phone}`}
                  className="text-primary hover:underline"
                >
                  {business.phone}
                </a>
              )}
              {business.website && (
                <a 
                  href={business.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Visit Website
                </a>
              )}
            </div>
            {business.description && (
              <p className="mt-4 text-sm text-muted-foreground">
                {business.description}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
} 