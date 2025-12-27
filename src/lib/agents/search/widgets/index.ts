import calculationWidget from './calculationWidget';
import WidgetExecutor from './executor';
import weatherWidget from './weatherWidget';
import stockWidget from './stockWidget';

WidgetExecutor.register(weatherWidget);
WidgetExecutor.register(calculationWidget);
WidgetExecutor.register(stockWidget);

export { WidgetExecutor };
