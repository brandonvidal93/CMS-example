import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

// El componente raíz no pinta nada propio: cada zona (público / admin) trae su layout
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class App {}
