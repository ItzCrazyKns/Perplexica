import { UIConfigField } from '@/lib/config/types';
import LocaleSwitcher from '@/components/LocaleSwitcher';
import SettingsField from '../SettingsField';
import { useTranslations } from 'next-intl';

const General = ({
  fields,
  values,
}: {
  fields: UIConfigField[];
  values: Record<string, any>;
}) => {
  const t = useTranslations('pages.settings.general');

  return (
    <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
      <section className="rounded-xl border border-light-200 bg-light-primary/80 p-4 lg:p-6 transition-colors dark:border-dark-200 dark:bg-dark-primary/80">
        <div className="space-y-3 lg:space-y-5">
          <div>
            <h4 className="text-sm lg:text-base text-black dark:text-white">
              {t('language.title')}
            </h4>
            <p className="text-[11px] lg:text-xs text-black/50 dark:text-white/50">
              {t('language.description')}
            </p>
          </div>
          <LocaleSwitcher />
        </div>
      </section>
      {fields.map((field) => (
        <SettingsField
          key={field.key}
          field={field}
          value={
            (field.scope === 'client'
              ? localStorage.getItem(field.key)
              : values[field.key]) ?? field.default
          }
          dataAdd="general"
        />
      ))}
    </div>
  );
};

export default General;
