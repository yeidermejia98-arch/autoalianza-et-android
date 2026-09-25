// Tipos compartidos por toda la app

// "Alcance" tal como los define el panel administrativo de la escuela
export type Category =
  | "mecanica_basica"
  | "adaptacion_medio"
  | "etica_prevencion"
  | "marco_legal"
  | "tecnicas_conduccion"
  | "otros";

export type Difficulty = "baja" | "media" | "alta";

export interface Question {
  id: string;
  category: Category;
  difficulty: Difficulty;
  question: string;
  options: string[]; // normalmente 3 o 4 opciones
  correctIndex: number; // índice (0-based) de la opción correcta dentro de options
  explanation?: string; // texto opcional que se muestra después de responder
  imageUrl?: string; // opcional, para preguntas con señal de tránsito
  isFree?: boolean; // true = disponible en la versión gratis / de muestra
  source?: string; // referencia a la sección del manual en que se basa la pregunta
}

export interface QuestionBank {
  version: string; // ej. "2026-07-15", útil para invalidar caché si se actualiza el banco
  examCategoryLabel: string; // ej. "Categoría B1 - Carro particular"
  questions: Question[];
}

// Una pregunta que el usuario respondió mal en el examen cronometrado, con
// todo lo necesario para mostrarla en el repaso de ResultsScreen sin tener
// que volver a buscarla en el banco completo.
export interface WrongAnswer {
  questionId: string;
  question: string;
  options: string[];
  correctIndex: number;
  selectedIndex: number;
  explanation?: string;
  source?: string;
}

export interface ExamResult {
  date: string; // ISO string
  total: number;
  correct: number;
  passed: boolean;
  passThreshold: number; // ej. 0.8 = 80%
  wrongAnswers?: WrongAnswer[]; // preguntas falladas, para el repaso al final
}

export interface PurchaseState {
  hasFullAccess: boolean;
  lastChecked: string; // ISO string
}
