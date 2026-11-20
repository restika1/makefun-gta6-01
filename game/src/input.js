export function createInput(canvas) {
  const down = new Set();
  const pressed = new Set();
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let clicked = null;

  const blocked = new Set([
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab',
  ]);

  function point(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  addEventListener('keydown', (event) => {
    if (blocked.has(event.code)) event.preventDefault();
    if (!down.has(event.code)) pressed.add(event.code);
    down.add(event.code);
  });
  addEventListener('keyup', (event) => {
    down.delete(event.code);
  });
  addEventListener('blur', () => {
    down.clear();
    mouseDown = false;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const p = point(event);
    mouseX = p.x;
    mouseY = p.y;
    mouseDown = true;
    clicked = p;
    if (event.button === 0) event.preventDefault();
  });
  addEventListener('pointerup', () => {
    mouseDown = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const p = point(event);
    mouseX = p.x;
    mouseY = p.y;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    down: (code) => down.has(code),
    pressed: (code) => pressed.has(code),
    anyDown: (...codes) => codes.some((c) => down.has(c)),
    anyPressed: (...codes) => codes.some((c) => pressed.has(c)),
    // Live getters: the pointer state changes after createInput returns, so a snapshot object
    // here would leave aiming and firing stuck at 0,0 / never down.
    mouse: {
      get x() {
        return mouseX;
      },
      get y() {
        return mouseY;
      },
      get down() {
        return mouseDown;
      },
    },
    takeClick() {
      const c = clicked;
      clicked = null;
      return c;
    },
    endFrame() {
      pressed.clear();
      clicked = null;
    },
    clear() {
      down.clear();
      pressed.clear();
      clicked = null;
      mouseDown = false;
    },
  };
}
