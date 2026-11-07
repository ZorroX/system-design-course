import { Prism } from 'prism-react-renderer'
// prismjs/components/* espera un Prism global: lo exponemos antes de cargar Java.
;(globalThis as unknown as { Prism: typeof Prism }).Prism = Prism
