import { render } from "preact";
import { App } from "./App";
import { isDesktop } from "./lib/desktop";
import "./styles.css";

if (isDesktop) document.documentElement.classList.add("desktop");

render(<App />, document.getElementById("app")!);
