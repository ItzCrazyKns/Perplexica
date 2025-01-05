export interface Category {
  id: string;
  name: string;
  icon: string;
  subcategories: SubCategory[];
}

export interface SubCategory {
  id: string;
  name: string;
}

export const categories: Category[] = [
  {
    id: 'real-estate-pros',
    name: 'Real Estate Professionals',
    icon: '🏢',
    subcategories: [
      { id: 'wholesalers', name: 'Real Estate Wholesalers' },
      { id: 'agents', name: 'Real Estate Agents' },
      { id: 'attorneys', name: 'Real Estate Attorneys' },
      { id: 'scouts', name: 'Property Scouts' },
      { id: 'brokers', name: 'Real Estate Brokers' },
      { id: 'consultants', name: 'Real Estate Consultants' }
    ]
  },
  {
    id: 'legal-title',
    name: 'Legal & Title Services',
    icon: '⚖️',
    subcategories: [
      { id: 'title-companies', name: 'Title Companies' },
      { id: 'closing-attorneys', name: 'Closing Attorneys' },
      { id: 'zoning-consultants', name: 'Zoning Consultants' },
      { id: 'probate-specialists', name: 'Probate Specialists' },
      { id: 'eviction-specialists', name: 'Eviction Specialists' }
    ]
  },
  {
    id: 'financial',
    name: 'Financial Services',
    icon: '💰',
    subcategories: [
      { id: 'hard-money', name: 'Hard Money Lenders' },
      { id: 'private-equity', name: 'Private Equity Investors' },
      { id: 'mortgage-brokers', name: 'Mortgage Brokers' },
      { id: 'tax-advisors', name: 'Tax Advisors' },
      { id: 'appraisers', name: 'Appraisers' }
    ]
  },
  {
    id: 'contractors',
    name: 'Specialist Contractors',
    icon: '🔨',
    subcategories: [
      { id: 'general', name: 'General Contractors' },
      { id: 'plumbers', name: 'Plumbers' },
      { id: 'electricians', name: 'Electricians' },
      { id: 'hvac', name: 'HVAC Technicians' },
      { id: 'roofers', name: 'Roofers' },
      { id: 'foundation', name: 'Foundation Specialists' },
      { id: 'asbestos', name: 'Asbestos Removal' },
      { id: 'mold', name: 'Mold Remediation' }
    ]
  },
  {
    id: 'property-services',
    name: 'Property Services',
    icon: '🏠',
    subcategories: [
      { id: 'surveyors', name: 'Surveyors' },
      { id: 'inspectors', name: 'Inspectors' },
      { id: 'property-managers', name: 'Property Managers' },
      { id: 'environmental', name: 'Environmental Consultants' },
      { id: 'junk-removal', name: 'Junk Removal Services' },
      { id: 'cleaning', name: 'Property Cleaning' }
    ]
  },
  {
    id: 'marketing',
    name: 'Marketing & Lead Gen',
    icon: '📢',
    subcategories: [
      { id: 'direct-mail', name: 'Direct Mail Services' },
      { id: 'social-media', name: 'Social Media Marketing' },
      { id: 'seo', name: 'SEO Specialists' },
      { id: 'ppc', name: 'PPC Advertising' },
      { id: 'lead-gen', name: 'Lead Generation' },
      { id: 'skip-tracing', name: 'Skip Tracing Services' }
    ]
  },
  {
    id: 'data-tech',
    name: 'Data & Technology',
    icon: '💻',
    subcategories: [
      { id: 'data-providers', name: 'Property Data Providers' },
      { id: 'crm', name: 'CRM Systems' },
      { id: 'valuation', name: 'Valuation Tools' },
      { id: 'virtual-tours', name: 'Virtual Tour Services' },
      { id: 'automation', name: 'Automation Tools' }
    ]
  },
  {
    id: 'specialty',
    name: 'Specialty Services',
    icon: '🎯',
    subcategories: [
      { id: 'auction', name: 'Auction Companies' },
      { id: 'relocation', name: 'Relocation Services' },
      { id: 'staging', name: 'Home Staging' },
      { id: 'photography', name: 'Real Estate Photography' },
      { id: 'virtual-assistant', name: 'Virtual Assistants' }
    ]
  }
]; 