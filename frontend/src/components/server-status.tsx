import { CheckCircle2, XCircle, AlertCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface ServiceStatus {
  name: string
  status: "running" | "error" | "warning"
}

interface ServerStatusProps {
  services: ServiceStatus[]
  error?: string
}

export function ServerStatus({ services, error }: ServerStatusProps) {
  if (error) {
    return (
      <Alert variant="destructive" className="max-w-md mx-auto mt-4">
        <XCircle className="h-4 w-4" />
        <AlertTitle>Server Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4 max-w-md mx-auto mt-4">
      <h2 className="text-xl font-semibold text-center mb-6">Service Status</h2>
      <div className="space-y-3">
        {services.map((service) => (
          <Alert 
            key={service.name}
            variant={service.status === "error" ? "destructive" : "default"}
            className="flex items-center justify-between hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              {service.status === "running" && (
                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
              )}
              {service.status === "error" && (
                <XCircle className="h-5 w-5 text-red-500 shrink-0" />
              )}
              {service.status === "warning" && (
                <AlertCircle className="h-5 w-5 text-yellow-500 shrink-0" />
              )}
              <AlertTitle className="font-medium">{service.name}</AlertTitle>
            </div>
            <span className={`text-sm ${
              service.status === "running" ? "text-green-600" :
              service.status === "error" ? "text-red-600" :
              "text-yellow-600"
            }`}>
              {service.status.charAt(0).toUpperCase() + service.status.slice(1)}
            </span>
          </Alert>
        ))}
      </div>
    </div>
  )
} 