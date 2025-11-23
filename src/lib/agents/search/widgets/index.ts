import calculationWidget from './calculationWidget';
import WidgetRegistry from './registry';
import weatherWidget from './weatherWidget';
import stockWidget from './stockWidget';

WidgetRegistry.register(weatherWidget);
WidgetRegistry.register(calculationWidget);
WidgetRegistry.register(stockWidget);

export { WidgetRegistry };
