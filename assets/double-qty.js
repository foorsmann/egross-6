// double-qty.js - Doar funcționalitate, fără injectare buton
// Autor: Saga Media / Egross
// Asigură funcționalitatea butonului care adaugă cantitatea minimă (pasul minim) pe orice element cu clasa .double-qty-btn existent în pagină

(function(){
  // Funcție comună pentru validare și highlight roșu la atingerea stocului
  function snapDown(val, step, min){
    if(!isFinite(val)) return min;
    if(val < min) return min;
    return Math.floor((val - min) / step) * step + min;
  }

  function clampAndSnap(val, step, min, max, snap){
    val = Math.min(val, max);
    if(val < min) val = min;
    if(snap && val !== max){
      val = snapDown(val, step, min);
    }
    return val;
  }

  function validateAndHighlightQty(input){
    // allow user to temporarily clear the field without forcing it back to 1
    if(input.value === ''){
      input.classList.remove('text-red-600');
      input.style.color = '';
      return;
    }
    var min = input.min ? parseInt(input.min,10) : 1;
    var step = parseInt(input.getAttribute('data-min-qty'), 10) || parseInt(input.step,10) || 1;
    var max = input.max ? parseInt(input.max, 10) : Infinity;
    var val = parseInt(input.value, 10);
    if(isNaN(val)) val = min;
    val = clampAndSnap(val, step, min, max, false);
    input.value = val;
    if(val >= max){
      input.classList.add('text-red-600');
      input.style.color = '#e3342f';
    }else{
      input.classList.remove('text-red-600');
      input.style.color = '';
    }
    return val;
  }

  // Actualizează starea butoanelor +/- în funcţie de valoarea curentă
  function updateQtyButtonsState(input){
    var container = input.closest('.quantity-input') || input.parentNode;
    if(!container) return;
    var plus = container.querySelector('[data-quantity-selector="increase"],[data-qty-change="inc"]');
    var minus = container.querySelector('[data-quantity-selector="decrease"],[data-qty-change="dec"]');
    if(input.disabled || input.readOnly){
      if(plus) plus.disabled = true;
      if(minus) minus.disabled = true;
      return;
    }

    var max = input.max ? parseInt(input.max, 10) : Infinity;
    var step = parseInt(input.getAttribute('data-min-qty'), 10) || parseInt(input.step,10) || 1;
    var minQty = step;
    var val = parseInt(input.value, 10);
    if(isNaN(val)) val = 0; // treat empty input as 0 so minus stays disabled

    if(plus) plus.disabled = isFinite(max) && val >= max;
    if(minus){
      // minus devine inactiv când valoarea curentă este sub sau egală cu minQty
      // adaugă verificarea pentru input manual mai mic decât min_qty
      minus.disabled = val <= minQty;
    }
  }

  // păstrăm pentru compatibilitate cu codul existent
  var updateIncreaseBtnState = updateQtyButtonsState;

  window.validateAndHighlightQty = validateAndHighlightQty;
  // expunem helperii pentru a putea fi folosiți și în cart/drawer
  window.updateQtyButtonsState = updateQtyButtonsState;
  window.adjustQuantityHelper = adjustQuantity;

var BUTTON_CLASS = 'double-qty-btn';


  function applyMinQty(){
    document.querySelectorAll('[data-min-qty]').forEach(function(input){
      var min = parseInt(input.getAttribute('data-min-qty'), 10);
      if(min && min > 0){
        input.min = 1; // allow manual quantities below min_qty everywhere
        input.step = min;
        // nu forţăm valoarea dacă este sub min_qty; doar actualizăm starea butoanelor
        validateAndHighlightQty(input);
        updateQtyButtonsState(input);
      }
    });
  }

  function syncOtherQtyInputs(changedInput){
    var productId = changedInput.dataset.productId;
    if(!productId) return;
    var value = changedInput.value;
    document.querySelectorAll('input[data-product-id="' + productId + '"][data-quantity-input]').forEach(function(input){
      if(input === changedInput) return;
      if(input.value !== value){
        input.value = value;
        validateAndHighlightQty(input);
        updateQtyButtonsState(input);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  }

  function applyCappedQtyState(sourceInput){
    var productId = sourceInput.dataset.productId;
    if(!productId) return;
    var inputs = document.querySelectorAll('input[data-product-id="' + productId + '"][data-quantity-input]');
    inputs.forEach(function(input){
      input.dataset.prevMin = input.min;
      var prevAttr = input.getAttribute('data-min-qty');
      if(prevAttr !== null) {
        input.dataset.prevMinQtyAttr = prevAttr;
      }
      input.removeAttribute('data-min-qty');
      input.min = 0;
      input.value = 0;
      input.classList.add('text-red-600');
      input.style.color = '#e3342f';
      if(typeof updateQtyButtonsState === 'function'){
        updateQtyButtonsState(input);
      }
      setTimeout(function(){
        input.value = 0;
        if(typeof updateQtyButtonsState === 'function'){
          updateQtyButtonsState(input);
        }
      },0);
      var clearWarning = function(){
        input.classList.remove('text-red-600');
        input.style.color = '';
        if(input.dataset.prevMin){
          input.min = input.dataset.prevMin;
          delete input.dataset.prevMin;
        }
        if(input.dataset.prevMinQtyAttr !== undefined){
          input.setAttribute('data-min-qty', input.dataset.prevMinQtyAttr);
          delete input.dataset.prevMinQtyAttr;
        }
        input.removeEventListener('input', clearWarning);
        input.removeEventListener('change', clearWarning);
        if(typeof window.syncOtherQtyInputs === 'function'){
          window.syncOtherQtyInputs(input);
        }
      };
      input.addEventListener('input', clearWarning, { once: true });
      input.addEventListener('change', clearWarning, { once: true });
    });
  }

  window.syncOtherQtyInputs = syncOtherQtyInputs;
  window.applyCappedQtyState = applyCappedQtyState;
async function checkCartLimits(){
  try{
    const cart = await fetch('/cart.js').then(r => r.json());
    const items = cart.items || [];

    document.querySelectorAll('input[data-quantity-input], input[data-collection-quantity-input]').forEach(function(input){
      if(input.closest('.scd-item') || input.closest('[data-cart-item]')) return;

      const max = parseInt(input.max,10);
      if(!max || !isFinite(max)) return;

      let variantId = null;
      if(input.dataset.variantId){
        variantId = parseInt(input.dataset.variantId,10);
      }
      if(!variantId){
        const form = input.closest('form');
        if(form){
          const varInput = form.querySelector('input[name="id"]');
          if(varInput) variantId = parseInt(varInput.value,10);
        }
      }
      if(!variantId) return;

      const item = items.find(it => it.variant_id === variantId);
      const cartQty = item ? item.quantity : 0;

      const isCollection = input.hasAttribute('data-collection-quantity-input');
      const container = input.closest(isCollection ? '.collection-quantity-input' : '.quantity-input') || input.parentNode;
      const plus = container ? container.querySelector(isCollection ? '[data-collection-quantity-selector="increase"]' : '[data-quantity-selector="increase"],[data-qty-change="inc"]') : null;
      const minus = container ? container.querySelector(isCollection ? '[data-collection-quantity-selector="decrease"]' : '[data-quantity-selector="decrease"],[data-qty-change="dec"]') : null;
      const valFn = isCollection ? window.collectionValidateAndHighlight : window.validateAndHighlightQty;
      const updFn = isCollection ? window.collectionUpdateQtyButtonsState : window.updateQtyButtonsState;

      if(cartQty >= max){
        if(!input.dataset.cartLimited){
          if(isCollection){
            if(typeof window.collectionApplyCappedQtyState === 'function'){
              window.collectionApplyCappedQtyState(input);
            }
          }else if(typeof window.applyCappedQtyState === 'function'){
            window.applyCappedQtyState(input);
          }
          input.dataset.cartLimited = '1';
        }
        input.disabled = true;
        input.readOnly = true;
        if(plus) plus.disabled = true;
        if(minus) minus.disabled = true;
        if(updFn) updFn(input);
      }else{
        if(input.dataset.cartLimited){
          input.disabled = false;
          input.readOnly = false;
          if(plus) plus.disabled = false;
          if(minus) minus.disabled = false;
          if(input.dataset.prevMin){
            input.min = input.dataset.prevMin;
            delete input.dataset.prevMin;
          }
          if(input.dataset.prevMinQtyAttr !== undefined){
            const attr = isCollection ? 'data-collection-min-qty' : 'data-min-qty';
            input.setAttribute(attr, input.dataset.prevMinQtyAttr);
            delete input.dataset.prevMinQtyAttr;
          }
          input.classList.remove('text-red-600');
          input.style.color = '';
          delete input.dataset.cartLimited;
        }
        if(valFn) valFn(input);
        if(updFn) updFn(input);
      }
    });
  }catch(e){
    // silently ignore errors
  }
}

  async function checkCartLimits(){
    try{
      const cart = await fetch('/cart.js').then(r => r.json());
      const items = cart.items || [];
      document.querySelectorAll('input[data-quantity-input], input[data-collection-quantity-input]').forEach(function(input){
        if(input.closest('.scd-item') || input.closest('[data-cart-item]')) return;
        let variantId = null;
        if(input.dataset.variantId){
          variantId = parseInt(input.dataset.variantId,10);
        }
        if(!variantId){
          const form = input.closest('form');
          if(form){
            const varInput = form.querySelector('input[name="id"]');
            if(varInput) variantId = parseInt(varInput.value,10);
          }
        }
        if(!variantId) return;

        // max available stock for this variant
        if(!input.dataset.originalMax || input.dataset.storedVariantId !== String(variantId)){
          const attrMax = parseInt(input.getAttribute('max'),10);
          if(!attrMax || !isFinite(attrMax)) return;
          input.dataset.originalMax = attrMax;
          input.dataset.storedVariantId = String(variantId);
        }
        const maxQty = parseInt(input.dataset.originalMax,10);
        if(!maxQty || !isFinite(maxQty)) return;

        const item = items.find(it => it.variant_id === variantId);
        const cartQty = item ? item.quantity : 0;
        const available = Math.max(maxQty - cartQty, 0);

        const isCollection = input.hasAttribute('data-collection-quantity-input');
        const container = input.closest(isCollection ? 'collection-quantity-input' : '.quantity-input') || input.parentNode;
        const plus = container ? container.querySelector(isCollection ? '[data-collection-quantity-selector="increase"]' : '[data-quantity-selector="increase"],[data-qty-change="inc"]') : null;
        const minus = container ? container.querySelector(isCollection ? '[data-collection-quantity-selector="decrease"]' : '[data-quantity-selector="decrease"],[data-qty-change="dec"]') : null;
        const valFn = isCollection ? window.collectionValidateAndHighlight : window.validateAndHighlightQty;
        const updFn = isCollection ? window.collectionUpdateQtyButtonsState : window.updateQtyButtonsState;

        if(cartQty >= maxQty){
          if(!input.dataset.cartLimited){
            if(isCollection){
              if(typeof window.collectionApplyCappedQtyState === 'function'){
                window.collectionApplyCappedQtyState(input);
              }
            }else if(typeof window.applyCappedQtyState === 'function'){
              window.applyCappedQtyState(input);
            }
            input.dataset.cartLimited = '1';
          }
          input.disabled = true;
          input.readOnly = true;
          if(plus) plus.disabled = true;
          if(minus) minus.disabled = true;
          if(updFn) updFn(input);
        }else{
          if(input.dataset.cartLimited){
            input.disabled = false;
            input.readOnly = false;
            if(plus) plus.disabled = false;
            if(minus) minus.disabled = false;
            if(input.dataset.prevMin){
              input.min = input.dataset.prevMin;
              delete input.dataset.prevMin;
            }
            if(input.dataset.prevMinQtyAttr !== undefined){
              var attr = isCollection ? 'data-collection-min-qty' : 'data-min-qty';
              input.setAttribute(attr, input.dataset.prevMinQtyAttr);
              delete input.dataset.prevMinQtyAttr;
            }
            input.classList.remove('text-red-600');
            input.style.color = '';
            delete input.dataset.cartLimited;
          }

          // refresh max attribute to remaining stock
          input.max = available;
          var minAttr = isCollection ? 'data-collection-min-qty' : 'data-min-qty';
          var minQty = parseInt(input.getAttribute(minAttr),10) || parseInt(input.step,10) || 1;
          var newVal = available < minQty ? available : minQty;
          input.value = newVal;

          if(valFn) valFn(input);
          if(updFn) updFn(input);
          if(!isCollection && typeof window.syncOtherQtyInputs === 'function'){
            window.syncOtherQtyInputs(input);
          }
        }
      });
    }catch(e){
      // silently ignore errors
    }
  }

  async function checkCartLimits(){
    try{
      const cart = await fetch('/cart.js').then(r => r.json());
      const items = cart.items || [];
      document.querySelectorAll('input[data-quantity-input], input[data-collection-quantity-input]').forEach(function(input){
        if(input.closest('.scd-item') || input.closest('[data-cart-item]')) return;
        let variantId = null;
        if(input.dataset.variantId){
          variantId = parseInt(input.dataset.variantId,10);
        }
        if(!variantId){
          const form = input.closest('form');
          if(form){
            const varInput = form.querySelector('input[name="id"]');
            if(varInput) variantId = parseInt(varInput.value,10);
          }
        }
        if(!variantId) return;

        // max available stock for this variant
        if(!input.dataset.originalMax || input.dataset.storedVariantId !== String(variantId)){
          const attrMax = parseInt(input.getAttribute('max'),10);
          if(!attrMax || !isFinite(attrMax)) return;
          input.dataset.originalMax = attrMax;
          input.dataset.storedVariantId = String(variantId);
        }
        const maxQty = parseInt(input.dataset.originalMax,10);
        if(!maxQty || !isFinite(maxQty)) return;

        const item = items.find(it => it.variant_id === variantId);
        const cartQty = item ? item.quantity : 0;
        const available = Math.max(maxQty - cartQty, 0);

        const isCollection = input.hasAttribute('data-collection-quantity-input');
        const container = input.closest(isCollection ? 'collection-quantity-input' : '.quantity-input') || input.parentNode;
        const plus = container ? container.querySelector(isCollection ? '[data-collection-quantity-selector="increase"]' : '[data-quantity-selector="increase"],[data-qty-change="inc"]') : null;
        const minus = container ? container.querySelector(isCollection ? '[data-collection-quantity-selector="decrease"]' : '[data-quantity-selector="decrease"],[data-qty-change="dec"]') : null;
        const group = container ? container.parentNode : null;
        const doubleBtn = group ? group.querySelector(isCollection ? '.collection-double-qty-btn' : '.double-qty-btn') : null;
        const valFn = isCollection ? window.collectionValidateAndHighlight : window.validateAndHighlightQty;
        const updFn = isCollection ? window.collectionUpdateQtyButtonsState : window.updateQtyButtonsState;

        if(cartQty >= maxQty){
          if(!input.dataset.cartLimited){
            if(isCollection){
              if(typeof window.collectionApplyCappedQtyState === 'function'){
                window.collectionApplyCappedQtyState(input);
              }
            }else if(typeof window.applyCappedQtyState === 'function'){
              window.applyCappedQtyState(input);
            }
            input.dataset.cartLimited = '1';
          }
          input.disabled = true;
          input.readOnly = true;
          if(plus) plus.disabled = true;
          if(minus) minus.disabled = true;
          if(doubleBtn) doubleBtn.disabled = true;
          if(updFn) updFn(input);
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }else{
          if(input.dataset.cartLimited){
            input.disabled = false;
            input.readOnly = false;
            if(plus) plus.disabled = false;
            if(minus) minus.disabled = false;
            if(input.dataset.prevMin){
              input.min = input.dataset.prevMin;
              delete input.dataset.prevMin;
            }
            if(input.dataset.prevMinQtyAttr !== undefined){
              var attr = isCollection ? 'data-collection-min-qty' : 'data-min-qty';
              input.setAttribute(attr, input.dataset.prevMinQtyAttr);
              delete input.dataset.prevMinQtyAttr;
            }
            input.classList.remove('text-red-600');
            input.style.color = '';
            delete input.dataset.cartLimited;
          }

          // refresh max attribute to remaining stock
          input.max = available;
          var minAttr = isCollection ? 'data-collection-min-qty' : 'data-min-qty';
          var minQty = parseInt(input.getAttribute(minAttr),10) || parseInt(input.step,10) || 1;
          var newVal = available < minQty ? available : minQty;
          input.value = newVal;
          var originalMin = null;
          if(available < minQty){
            originalMin = input.min;
            input.min = 0;
          }
          if(valFn) valFn(input);
          if(originalMin !== null){
            input.min = originalMin;
          }
          if(doubleBtn) doubleBtn.disabled = available < minQty;
          if(updFn) updFn(input);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          if(!isCollection && typeof window.syncOtherQtyInputs === 'function'){
            window.syncOtherQtyInputs(input);
          }
        }
      });
    }catch(e){
      // silently ignore errors
    }
  }

  function attachQtyInputListeners(){
    var selectors = '.quantity-input__element, .scd-item__qty_input, input[data-quantity-input]';
    document.querySelectorAll(selectors).forEach(function(input){
      if(input.dataset.qtyListener) return;
      input.dataset.qtyListener = '1';
      ['input','change','blur'].forEach(function(ev){
        input.addEventListener(ev, function(){
          validateAndHighlightQty(input);
          updateQtyButtonsState(input);
          syncOtherQtyInputs(input);
        });
      });
      input.addEventListener('keypress', function(e){
        if(e.key === 'Enter'){
          validateAndHighlightQty(input);
          updateQtyButtonsState(input);
          syncOtherQtyInputs(input);
        }
      });
      validateAndHighlightQty(input);
      updateQtyButtonsState(input);
      syncOtherQtyInputs(input);
    });
  }

  // Nu validăm logică pentru cart/drawer (lăsăm tema să o gestioneze separat!)
  var qtyBtnListenerAdded = false;
  function attachQtyButtonListeners(){
    if(qtyBtnListenerAdded) return;
    qtyBtnListenerAdded = true;
    document.addEventListener('click', function(e){
      var btn = e.target.closest('[data-quantity-selector],[data-qty-change]');
      if(!btn) return;

      // Nu interferăm cu butoanele din cart/drawer – tema le gestionează!
      if(btn.closest('.scd-item') || btn.closest('[data-cart-item]')) return;

      var container = btn.closest('.quantity-input') || btn.parentNode;
      var input = container.querySelector('input[type="number"]');
      if(input){
        var before = input.value;
        setTimeout(function(){
          var action = btn.getAttribute('data-quantity-selector') || btn.getAttribute('data-qty-change');
          if(action === 'increase' || action === 'inc'){
            adjustQuantity(input, 1, before);
          }else if(action === 'decrease' || action === 'dec'){
            adjustQuantity(input, -1, before);
          }else{
            validateAndHighlightQty(input);
            updateQtyButtonsState(input);
          }
        }, 0);
      }
    }, true);
  }

  function adjustQuantity(input, delta, baseVal){
    var step = parseInt(input.getAttribute('data-min-qty'), 10) || 1;
    var max = input.max ? parseInt(input.max, 10) : Infinity;
    var minQty = step; // valoarea minimă configurată
    var val = baseVal !== undefined ? parseInt(baseVal,10) : parseInt(input.value, 10);
    if(isNaN(val)) val = 1;

    // Dacă suntem la maxim, doar validează și colorează
    if(delta > 0 && isFinite(max) && val >= max){
      validateAndHighlightQty(input);
      updateQtyButtonsState(input);
      return;
    }

    if(delta < 0){
      // Snap la multiplu inferior plecând de la minQty
      if((val - minQty) % step !== 0){
        val = Math.floor((val - minQty) / step) * step + minQty;
      }else{
        val -= step;
      }
      if(val < minQty) val = minQty;
    }else{
      // Snap la multiplu superior plecând de la minQty
      if((val - minQty) % step !== 0){
        val = Math.ceil((val - minQty) / step) * step + minQty;
      }else{
        val += step;
      }
      if(val > max) val = max;
    }

    var newVal = clampAndSnap(val, step, 1, max);
    input.value = newVal;
    if(newVal >= max){
      input.classList.add('text-red-600');
      input.style.color = '#e3342f';
    }else{
      input.classList.remove('text-red-600');
      input.style.color = '';
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    updateQtyButtonsState(input);
  }

  function findQtyInput(btn) {
    let wrapper = btn.previousElementSibling;
    if (wrapper && wrapper.classList && wrapper.classList.contains('quantity-input')) {
      let input = wrapper.querySelector('input[type="number"]');
      if (input) return input;
    }
    if (btn.previousElementSibling && btn.previousElementSibling.tagName === 'INPUT') {
      return btn.previousElementSibling;
    }
    return btn.parentNode.querySelector('input[type="number"]');
  }

  function initDoubleQtyButtons() {
    document.querySelectorAll('.' + BUTTON_CLASS).forEach(function(btn){
      if (btn.hasAttribute('data-collection-double-qty') || btn.classList.contains('collection-double-qty-btn')) return;
      var input = findQtyInput(btn);
      if (!input) return;
      var storedMin = parseInt(btn.getAttribute('data-original-min-qty'), 10);
      var min;
      if(isNaN(storedMin)){
        min = parseInt(input.getAttribute('data-min-qty'), 10) || 1;
        btn.setAttribute('data-original-min-qty', min);
      }else{
        min = storedMin;
      }
      var template = btn.getAttribute('data-label-template') || btn.textContent;
      var label = template.replace('{min_qty}', min);
      btn.setAttribute('aria-label', label);
      btn.textContent = label;

      if (btn.dataset.doubleQtyActive) return;
      btn.dataset.doubleQtyActive = '1';

      function updateBtnState() {
        if(input.disabled || input.readOnly){
          btn.disabled = true;
          return;
        }
        var max = input.max ? parseInt(input.max, 10) : 9999;
        var val = parseInt(input.value, 10) || 1;
        btn.disabled = val >= max;
        validateAndHighlightQty(input);
        updateQtyButtonsState(input);
      }
      updateBtnState();
      input.addEventListener('input', updateBtnState);
      input.addEventListener('change', updateBtnState);

      btn.addEventListener('click', function(e){
        e.preventDefault();
        var step = parseInt(input.getAttribute('data-min-qty'), 10) || parseInt(input.step,10) || 1;
        var max = input.max ? parseInt(input.max, 10) : Infinity;
        var current = parseInt(input.value, 10);
        if(isNaN(current)) current = 0;
        var newVal = current + step;
        if(newVal > max) newVal = max;
        input.value = newVal;
        validateAndHighlightQty(input);
        updateQtyButtonsState(input);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        updateBtnState();
      });

      btn.addEventListener('focus', function(){ btn.classList.add('focus'); });
      btn.addEventListener('blur', function(){ btn.classList.remove('focus'); });
    });
  }

  function initAll(){
    applyMinQty();
    initDoubleQtyButtons();
    attachQtyInputListeners();
    attachQtyButtonListeners();
  }
  document.addEventListener('DOMContentLoaded', initAll);
  window.addEventListener('shopify:section:load', initAll);
  window.addEventListener('shopify:cart:updated', initAll);
  window.addEventListener('shopify:product:updated', initAll);

  document.addEventListener('DOMContentLoaded', checkCartLimits);
  window.addEventListener('shopify:cart:updated', checkCartLimits);
  window.addEventListener('shopify:section:load', checkCartLimits);
  window.addEventListener('shopify:product:updated', checkCartLimits);

  window.doubleQtyInit = initDoubleQtyButtons;
})();








