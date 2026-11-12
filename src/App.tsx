import { Escena } from './escena/Escena';
import { CapaEtiquetas } from './escena/Etiquetas';
import { Interfaz } from './ui/Interfaz';

export function App() {
  return (
    <div className="app">
      <Escena />
      <CapaEtiquetas />
      <Interfaz />
    </div>
  );
}
