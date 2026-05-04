'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertCircle, Plus, Trash2 } from 'lucide-react';

interface TemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  text?: string;
  example?: {
    header_text?: string[];
    body_text?: string[][];
  };
  buttons?: Array<{
    type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
    text: string;
    url?: string;
    phone_number?: string;
  }>;
}

interface TemplateBuilderProps {
  initialName?: string;
  initialCategory?: string;
  initialLanguage?: string;
  initialComponents?: TemplateComponent[];
  onSave: (data: {
    name: string;
    category: string;
    language: string;
    components: TemplateComponent[];
  }) => void;
  onCancel: () => void;
}

function validateTemplateName(name: string): string | null {
  if (!name) return 'Nome é obrigatório';
  if (!/^[a-z0-9_]+$/.test(name)) {
    return 'Nome deve conter apenas letras minúsculas, números e underscore';
  }
  if (name.length < 1 || name.length > 512) {
    return 'Nome deve ter entre 1 e 512 caracteres';
  }
  return null;
}

function hasEmojis(text: string): boolean {
  const emojiRegex = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/u;
  return emojiRegex.test(text);
}

function extractVariables(text: string): string[] {
  const matches = text.match(/\{\{(\d+)\}\}/g);
  if (!matches) return [];
  return matches.map(m => m.replace(/[{}]/g, ''));
}

export function TemplateBuilder({
  initialName = '',
  initialCategory = 'MARKETING',
  initialLanguage = 'pt_BR',
  initialComponents = [],
  onSave,
  onCancel,
}: TemplateBuilderProps) {
  const [name, setName] = useState(initialName);
  const [category, setCategory] = useState(initialCategory);
  const [language, setLanguage] = useState(initialLanguage);
  const [components, setComponents] = useState<TemplateComponent[]>(
    initialComponents.length > 0
      ? initialComponents
      : [{ type: 'BODY', text: '' }]
  );

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateComponents = (): boolean => {
    const newErrors: Record<string, string> = {};

    const nameError = validateTemplateName(name);
    if (nameError) {
      newErrors.name = nameError;
    }

    components.forEach((comp, idx) => {
      if (comp.type === 'HEADER' && comp.format === 'TEXT') {
        if (comp.text && comp.text.length > 60) {
          newErrors[`header_${idx}`] = 'Header limitado a 60 caracteres';
        }
        if (comp.text && hasEmojis(comp.text)) {
          newErrors[`header_emoji_${idx}`] = 'Header não pode conter emojis';
        }
      }

      if (comp.type === 'BODY') {
        if (!comp.text || comp.text.trim() === '') {
          newErrors[`body_${idx}`] = 'Corpo do template é obrigatório';
        }
      }

      if (comp.type === 'FOOTER') {
        if (comp.text && comp.text.length > 60) {
          newErrors[`footer_${idx}`] = 'Footer limitado a 60 caracteres';
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddComponent = (type: TemplateComponent['type']) => {
    if (type === 'HEADER') {
      setComponents([{ type: 'HEADER', format: 'TEXT', text: '' }, ...components]);
    } else if (type === 'FOOTER') {
      const bodyIndex = components.findIndex(c => c.type === 'BODY');
      const insertIndex = bodyIndex !== -1 ? bodyIndex + 1 : components.length;
      const newComps = [...components];
      newComps.splice(insertIndex, 0, { type: 'FOOTER', text: '' });
      setComponents(newComps);
    } else if (type === 'BUTTONS') {
      setComponents([
        ...components,
        {
          type: 'BUTTONS',
          buttons: [{ type: 'QUICK_REPLY', text: '' }],
        },
      ]);
    }
  };

  const handleRemoveComponent = (index: number) => {
    setComponents(components.filter((_, i) => i !== index));
  };

  const handleComponentChange = (index: number, field: string, value: any) => {
    const newComponents = [...components];
    const component = newComponents[index];
    if (!component) return;
    
    if (field === 'text') {
      component.text = value;
    } else if (field === 'format') {
      component.format = value;
    }
    setComponents(newComponents);
  };

  const handleAddButton = (componentIndex: number) => {
    const newComponents = [...components];
    const component = newComponents[componentIndex];
    if (!component) return;
    
    if (component.type === 'BUTTONS') {
      component.buttons = component.buttons || [];
      component.buttons.push({ type: 'QUICK_REPLY', text: '' });
    }
    setComponents(newComponents);
  };

  const handleRemoveButton = (componentIndex: number, buttonIndex: number) => {
    const newComponents = [...components];
    const component = newComponents[componentIndex];
    if (!component) return;
    
    if (component.type === 'BUTTONS' && component.buttons) {
      component.buttons = component.buttons.filter((_, i) => i !== buttonIndex);
    }
    setComponents(newComponents);
  };

  const handleButtonChange = (
    componentIndex: number,
    buttonIndex: number,
    field: string,
    value: any
  ) => {
    const newComponents = [...components];
    const component = newComponents[componentIndex];
    if (!component) return;
    
    if (component.type === 'BUTTONS' && component.buttons) {
      (component.buttons[buttonIndex] as any)[field] = value;
    }
    setComponents(newComponents);
  };

  const handleSave = () => {
    if (validateComponents()) {
      onSave({ name, category, language, components });
    }
  };

  const hasHeader = components.some(c => c.type === 'HEADER');
  const hasFooter = components.some(c => c.type === 'FOOTER');
  const hasButtons = components.some(c => c.type === 'BUTTONS');

  return (
    <div className="space-y-6">
      {/* Informações Básicas */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="template-name">Nome do Template *</Label>
          <Input
            id="template-name"
            value={name}
            onChange={e => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            placeholder="nome_do_template"
            className={errors.name ? 'border-red-500' : ''}
          />
          {errors.name && (
            <p className="text-sm text-red-500 mt-1 flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              {errors.name}
            </p>
          )}
          <p className="text-sm text-muted-foreground mt-1">
            Apenas letras minúsculas, números e underscore
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="category">Categoria *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MARKETING">Marketing</SelectItem>
                <SelectItem value="UTILITY">Utilidade</SelectItem>
                <SelectItem value="AUTHENTICATION">Autenticação</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="language">Idioma *</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger id="language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pt_BR">Português (BR)</SelectItem>
                <SelectItem value="en_US">English (US)</SelectItem>
                <SelectItem value="es">Español</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Componentes do Template */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Label>Componentes do Template</Label>
          <div className="flex gap-2">
            {!hasHeader && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleAddComponent('HEADER')}
              >
                <Plus className="h-4 w-4 mr-1" />
                Header
              </Button>
            )}
            {!hasFooter && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleAddComponent('FOOTER')}
              >
                <Plus className="h-4 w-4 mr-1" />
                Footer
              </Button>
            )}
            {!hasButtons && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleAddComponent('BUTTONS')}
              >
                <Plus className="h-4 w-4 mr-1" />
                Buttons
              </Button>
            )}
          </div>
        </div>

        {components.map((component, index) => (
          <div key={index} className="border rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="font-medium">{component.type}</h4>
              {component.type !== 'BODY' && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveComponent(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>

            {component.type === 'HEADER' && (
              <>
                <div>
                  <Label>Formato</Label>
                  <Select
                    value={component.format || 'TEXT'}
                    onValueChange={value => handleComponentChange(index, 'format', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TEXT">Texto</SelectItem>
                      <SelectItem value="IMAGE">Imagem</SelectItem>
                      <SelectItem value="VIDEO">Vídeo</SelectItem>
                      <SelectItem value="DOCUMENT">Documento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {component.format === 'TEXT' && (
                  <div>
                    <Label>Texto do Header</Label>
                    <Input
                      value={component.text || ''}
                      onChange={e => handleComponentChange(index, 'text', e.target.value)}
                      placeholder="Título do template"
                      maxLength={60}
                      className={
                        errors[`header_${index}`] || errors[`header_emoji_${index}`]
                          ? 'border-red-500'
                          : ''
                      }
                    />
                    {(errors[`header_${index}`] || errors[`header_emoji_${index}`]) && (
                      <p className="text-sm text-red-500 mt-1">
                        {errors[`header_${index}`] || errors[`header_emoji_${index}`]}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground mt-1">
                      {(component.text || '').length}/60 caracteres (sem emojis)
                    </p>
                    {extractVariables(component.text || '').length > 0 && (
                      <p className="text-sm text-blue-600 mt-1">
                        Variáveis detectadas: {extractVariables(component.text || '').join(', ')}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}

            {component.type === 'BODY' && (
              <div>
                <Label>Corpo da Mensagem *</Label>
                <Textarea
                  value={component.text || ''}
                  onChange={e => handleComponentChange(index, 'text', e.target.value)}
                  placeholder="Digite o corpo do template... Use {{1}}, {{2}} para variáveis."
                  rows={4}
                  className={errors[`body_${index}`] ? 'border-red-500' : ''}
                />
                {errors[`body_${index}`] && (
                  <p className="text-sm text-red-500 mt-1">{errors[`body_${index}`]}</p>
                )}
                {extractVariables(component.text || '').length > 0 && (
                  <p className="text-sm text-blue-600 mt-1">
                    Variáveis detectadas: {extractVariables(component.text || '').join(', ')}
                  </p>
                )}
                <p className="text-sm text-muted-foreground mt-1">
                  {(component.text || '').length} caracteres
                </p>
              </div>
            )}

            {component.type === 'FOOTER' && (
              <div>
                <Label>Texto do Footer</Label>
                <Input
                  value={component.text || ''}
                  onChange={e => handleComponentChange(index, 'text', e.target.value)}
                  placeholder="Texto do rodapé"
                  maxLength={60}
                  className={errors[`footer_${index}`] ? 'border-red-500' : ''}
                />
                {errors[`footer_${index}`] && (
                  <p className="text-sm text-red-500 mt-1">{errors[`footer_${index}`]}</p>
                )}
                <p className="text-sm text-muted-foreground mt-1">
                  {(component.text || '').length}/60 caracteres
                </p>
              </div>
            )}

            {component.type === 'BUTTONS' && (
              <div className="space-y-3">
                {component.buttons?.map((button, buttonIndex) => (
                  <div key={buttonIndex} className="border rounded p-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <Label>Botão {buttonIndex + 1}</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveButton(index, buttonIndex)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div>
                      <Label className="text-sm">Tipo</Label>
                      <Select
                        value={button.type}
                        onValueChange={value =>
                          handleButtonChange(index, buttonIndex, 'type', value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="QUICK_REPLY">Resposta Rápida</SelectItem>
                          <SelectItem value="URL">URL</SelectItem>
                          <SelectItem value="PHONE_NUMBER">Telefone</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-sm">Texto do Botão</Label>
                      <Input
                        value={button.text}
                        onChange={e =>
                          handleButtonChange(index, buttonIndex, 'text', e.target.value)
                        }
                        placeholder="Texto do botão"
                        maxLength={25}
                      />
                    </div>

                    {button.type === 'URL' && (
                      <div>
                        <Label className="text-sm">URL</Label>
                        <Input
                          value={button.url || ''}
                          onChange={e =>
                            handleButtonChange(index, buttonIndex, 'url', e.target.value)
                          }
                          placeholder="https://exemplo.com"
                        />
                      </div>
                    )}

                    {button.type === 'PHONE_NUMBER' && (
                      <div>
                        <Label className="text-sm">Telefone</Label>
                        <Input
                          value={button.phone_number || ''}
                          onChange={e =>
                            handleButtonChange(index, buttonIndex, 'phone_number', e.target.value)
                          }
                          placeholder="+5511999999999"
                        />
                      </div>
                    )}
                  </div>
                ))}

                {(component.buttons?.length || 0) < 3 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddButton(index)}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar Botão
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Preview */}
      <div className="border rounded-lg p-4 bg-muted/30">
        <h4 className="font-medium mb-3">Preview</h4>
        <div className="bg-white dark:bg-gray-900 rounded-lg p-4 max-w-sm border">
          {components.map((comp, idx) => {
            if (comp.type === 'HEADER' && comp.format === 'TEXT' && comp.text) {
              return (
                <div key={idx} className="font-bold mb-2">
                  {comp.text}
                </div>
              );
            }
            if (comp.type === 'BODY' && comp.text) {
              return (
                <div key={idx} className="mb-2 whitespace-pre-wrap">
                  {comp.text}
                </div>
              );
            }
            if (comp.type === 'FOOTER' && comp.text) {
              return (
                <div key={idx} className="text-sm text-muted-foreground mt-2">
                  {comp.text}
                </div>
              );
            }
            if (comp.type === 'BUTTONS' && comp.buttons && comp.buttons.length > 0) {
              return (
                <div key={idx} className="mt-3 space-y-2">
                  {comp.buttons.map((btn, btnIdx) => (
                    <div
                      key={btnIdx}
                      className="border rounded px-3 py-2 text-center text-sm text-blue-600 cursor-pointer hover:bg-blue-50"
                    >
                      {btn.text || 'Botão'}
                    </div>
                  ))}
                </div>
              );
            }
            return null;
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="button" onClick={handleSave}>
          Salvar Template
        </Button>
      </div>
    </div>
  );
}
