const BusinessList = ({ businesses }: { businesses: BusinessData[] }) => {
    console.log('Rendering BusinessList with:', businesses);
    
    if (!businesses.length) {
        return <div>No businesses found</div>;
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {businesses.map(business => (
                <BusinessCard key={business.id} business={business} />
            ))}
        </div>
    );
}; 