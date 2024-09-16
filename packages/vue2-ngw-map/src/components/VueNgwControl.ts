import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop } from 'vue-property-decorator';

import { findNgwMapParent, propsBinder } from '../utils';

import type { VueNgwMap } from './VueNgwMap';
import type { NgwMap } from '@nextgis/ngw-map';
import type {
  ControlPosition,
  CreateControlOptions,
  MapControl,
  MapControls,
} from '@nextgis/webmap';
import type { CreateElement, VNode, VNodeData } from 'vue';

@Component
export class VueNgwControl extends Vue {
  @Prop({ type: String }) readonly position!: ControlPosition;
  @Prop({ type: Boolean }) readonly bar!: boolean;
  @Prop({ type: Boolean }) readonly margin!: boolean;
  @Prop({ type: String }) readonly addClass!: string;
  @Prop({ type: String }) readonly kind!: keyof MapControls;
  @Prop({ type: Object, default: () => ({}) })
  readonly controlOptions!: CreateControlOptions;

  parentContainer?: VueNgwMap;
  name = 'vue-ngw-control';
  control?: unknown;
  ready = false;

  containerElement?: HTMLElement;
  vueInstance?: Vue;

  get ngwMap(): NgwMap | undefined {
    return this.parentContainer && this.parentContainer.ngwMap;
  }

  beforeDestroy(): void {
    if (this.ngwMap && this.control) {
      this.ngwMap.removeControl(this.control);
      this.control = undefined;
    }
  }

  async setControl(element: HTMLElement | Vue): Promise<void> {
    const ngwMap = this.ngwMap;
    const control = this.control;
    if (ngwMap) {
      if (control) {
        ngwMap.removeControl(control);
      }

      const adControlOptions: CreateControlOptions = {
        ...this.$props,
        ...this.$props.controlOptions,
      };

      let el: HTMLElement;

      if (element instanceof Vue) {
        this.containerElement = document.createElement('div');
        el = this.containerElement;
      } else {
        el = element as HTMLElement;
      }

      const controlObject: MapControl = {
        onAdd: () => {
          return el;
        },
        onRemove: () => {
          // ignore
        },
      };

      let _control: keyof MapControls | any = this.kind;
      if (!_control) {
        _control = await ngwMap.createControl(controlObject, adControlOptions);
      }
      this.control = ngwMap.addControl(_control, this.position);

      if (element instanceof Vue) {
        this.$nextTick(() => {
          setTimeout(() => {
            this.vueInstance?.$mount(this.containerElement);
          });
        });
      }
    }
  }

  mounted(): void {
    const parent = this.$parent;
    if (parent) {
      this.parentContainer = findNgwMapParent(parent);
    }

    const slotContent = this.$slots.default ? this.$slots.default[0] : null;
    if (slotContent && slotContent.componentOptions) {
      const ComponentConstructor = Vue.extend(
        slotContent.componentOptions.Ctor,
      );
      const componentInstance = new ComponentConstructor({
        propsData: slotContent.data && slotContent.data.attrs,
      });
      this.vueInstance = componentInstance;
      this.setControl(componentInstance);
    } else {
      this.setControl(this.$el as HTMLElement);
    }

    this.ready = true;
    propsBinder(this, this.$props);

    this.$nextTick(() => {
      this.$emit('ready', this.control);
      this.$emit('load', this.ngwMap);
    });
  }

  render(h: CreateElement): VNode {
    const staticStyle: { [param: string]: string } = {
      // zIndex: '0'
    };

    const data: VNodeData = {
      staticClass: 'vue-ngw-control',
      staticStyle,
      attrs: { 'data-app': true },
    };
    return this.ready ? h('div', data, this.$slots.default) : h('div', data);
  }
}

export default VueNgwControl;
