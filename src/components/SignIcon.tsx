import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { CategoriaSenal } from "../data/senalesTransito";

// Recreación vectorial simple de cada categoría de señal (forma + color
// oficiales), construida solo con Views de React Native — sin librerías
// nuevas ni imágenes escaneadas de ningún manual. No son réplicas exactas
// del arte oficial, son una representación fiel de la forma y el color
// reglamentarios para que la señal se reconozca a simple vista.

interface Props {
  categoria: CategoriaSenal;
  size?: number;
}

export default function SignIcon({ categoria, size = 56 }: Props) {
  if (categoria === "preventiva") {
    // Rombo amarillo (cuadrado rotado 45°)
    const side = size * 0.72;
    return (
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <View
          style={[
            styles.diamond,
            {
              width: side,
              height: side,
              transform: [{ rotate: "45deg" }],
            },
          ]}
        />
      </View>
    );
  }

  if (categoria === "informativa") {
    // Rectángulo azul con esquinas redondeadas
    return (
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <View style={[styles.infoBox, { width: size * 0.9, height: size * 0.68 }]} />
      </View>
    );
  }

  // reglamentaria: círculo blanco con borde rojo grueso (PARE se dibuja
  // aparte, con octágono, desde la pantalla que lo necesite si hace falta)
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <View
        style={[
          styles.circle,
          { width: size * 0.86, height: size * 0.86, borderRadius: (size * 0.86) / 2 },
        ]}
      />
    </View>
  );
}

// Variante especial para PARE (octágono rojo) y CEDA EL PASO (triángulo
// invertido rojo), que tienen forma propia distinta al resto de las
// reglamentarias.
export function SpecialSignIcon({ id, size = 56 }: { id: string; size?: number }) {
  if (id === "sr-pare") {
    return (
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <View style={{ width: size * 0.8, height: size * 0.8 }}>
          <View
            style={[
              styles.octagonBase,
              { width: size * 0.8, height: size * 0.8, transform: [{ rotate: "0deg" }] },
            ]}
          />
          <View
            style={[
              styles.octagonBase,
              {
                width: size * 0.8,
                height: size * 0.8,
                position: "absolute",
                transform: [{ rotate: "45deg" }],
              },
            ]}
          />
          <View style={StyleSheet.absoluteFillObject}>
            <Text style={[styles.pareText, { fontSize: size * 0.22 }]}>PARE</Text>
          </View>
        </View>
      </View>
    );
  }

  if (id === "sr-ceda") {
    const side = size * 0.9;
    return (
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <View
          style={{
            width: 0,
            height: 0,
            borderLeftWidth: side / 2,
            borderRightWidth: side / 2,
            borderTopWidth: side * 0.78,
            borderLeftColor: "transparent",
            borderRightColor: "transparent",
            borderTopColor: "#dc2626",
          }}
        />
      </View>
    );
  }

  return <SignIcon categoria="reglamentaria" size={size} />;
}

const styles = StyleSheet.create({
  circle: {
    backgroundColor: "#FFFFFF",
    borderWidth: 5,
    borderColor: "#dc2626",
  },
  diamond: {
    backgroundColor: "#F8E906",
    borderWidth: 3,
    borderColor: "#231F20",
  },
  infoBox: {
    backgroundColor: "#0D88D8",
    borderRadius: 6,
  },
  octagonBase: {
    position: "absolute",
    backgroundColor: "#dc2626",
  },
  pareText: {
    flex: 1,
    textAlign: "center",
    textAlignVertical: "center",
    color: "#FFFFFF",
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});
