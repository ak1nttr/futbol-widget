import { createContext } from "preact";
import { useContext } from "preact/hooks";

export type Route =
  | { kind: "home" }
  | { kind: "team"; id: number }
  | { kind: "match"; id: number }
  | { kind: "settings" };

export interface Nav {
  push: (r: Route) => void;
  back: () => void;
}

export const NavContext = createContext<Nav>({ push: () => {}, back: () => {} });
export const useNav = () => useContext(NavContext);
