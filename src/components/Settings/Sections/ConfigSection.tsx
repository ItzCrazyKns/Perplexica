import { UIConfigField } from '@/lib/config/types';
import SettingsField from '../SettingsField';

/* Replaces the formerly identical Preferences, Personalization and
   Search section components, which differed only in dataAdd. */
const ConfigSection = ({
  fields,
  values,
  dataAdd,
}: {
  fields: UIConfigField[];
  values: Record<string, any>;
  dataAdd: string;
}) => {
  return (
    <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
      {fields.map((field) => (
        <SettingsField
          key={field.key}
          field={field}
          value={
            (field.scope === 'client'
              ? localStorage.getItem(field.key)
              : values[field.key]) ?? field.default
          }
          dataAdd={dataAdd}
        />
      ))}
    </div>
  );
};

export default ConfigSection;
