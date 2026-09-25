import { useEffect } from "react";
import { Alert } from "react-native";
import * as ScreenCapture from "expo-screen-capture";

// Protege el contenido del banco de preguntas (práctica y examen) contra
// capturas de pantalla.
//
// IMPORTANTE - qué tan efectivo es esto realmente:
// - En Android sí se puede BLOQUEAR por completo: el sistema operativo no
//   deja que se tome la captura (sale una notificación de "no se pudo
//   capturar la pantalla" o una imagen en negro), gracias a la bandera
//   FLAG_SECURE que activa `preventScreenCaptureAsync`.
// - En iOS, Apple NO le da a ninguna app la posibilidad de bloquear una
//   captura de pantalla - es una limitación del sistema operativo, no de
//   esta app. Lo único que sí se puede hacer en iOS es DETECTAR cuando el
//   usuario tomó una captura (después de que ya la tomó) y mostrarle un
//   aviso, que es lo que hace este archivo con `addScreenshotListener`.
//
// En resumen: en Android, tus preguntas quedan protegidas de verdad. En
// iOS, no hay forma 100% de impedirlo (ninguna app de la App Store puede
// hacerlo), pero sí puedes avisarle al usuario que quedó registrado.
export function useScreenCaptureProtection() {
  useEffect(() => {
    ScreenCapture.preventScreenCaptureAsync();

    const subscription = ScreenCapture.addScreenshotListener(() => {
      Alert.alert(
        "Captura de pantalla detectada",
        "El banco de preguntas es contenido exclusivo de AUTOALIANZA. Por favor no compartas capturas de pantalla del examen."
      );
    });

    return () => {
      ScreenCapture.allowScreenCaptureAsync();
      subscription.remove();
    };
  }, []);
}
