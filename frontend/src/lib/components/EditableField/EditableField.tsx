import { Button, Input } from 'antd'
import { EditOutlined } from '@ant-design/icons'
import React, { useEffect, useState } from 'react'
import './EditableField.scss'

interface EditableFieldProps {
    name: string
    value: string
    placeholder?: string
    /** Whether editing is locked due to this being a premium feature. */
    locked?: boolean
    className: string
    dataAttr: string
    onChange: (value: string) => void
    multiline?: boolean
}

export function EditableField({
    name,
    value,
    onChange,
    className,
    dataAttr,
    placeholder,
    multiline,
}: EditableFieldProps): JSX.Element {
    const [isEditing, setIsEditing] = useState(false)
    const [editedValue, setEditedValue] = useState(value)

    useEffect(() => {
        setEditedValue(value)
    }, [value])

    return (
        <div
            className={`editable-field${className ? ` ${className}` : ''} ${isEditing ? 'edit-mode' : 'view-mode'}`}
            data-attr={dataAttr}
        >
            {isEditing ? (
                <div className="edit-container ant-input-affix-wrapper ant-input-affix-wrapper-lg editable-textarea-wrapper">
                    <Input.TextArea
                        autoFocus
                        placeholder={placeholder}
                        value={multiline ? editedValue : editedValue.split('\n').join('')}
                        onChange={(e) => setEditedValue(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                onChange(editedValue)
                                setIsEditing(false)
                            }
                        }}
                        autoSize={{ minRows: 1, maxRows: 5 }}
                    />

                    <Button className="btn-cancel" size="small" onClick={() => setIsEditing(false)}>
                        Cancel
                    </Button>
                    <Button
                        className="ml-025"
                        type="primary"
                        size="small"
                        onClick={() => {
                            onChange(editedValue)
                            setIsEditing(false)
                        }}
                    >
                        Done
                    </Button>
                </div>
            ) : (
                <div className="view-container">
                    <span className="field">{value || <i>{placeholder}</i>}</span>
                    <Button
                        type="link"
                        onClick={() => {
                            setEditedValue(value)
                            setIsEditing(true)
                        }}
                        className="btn-edit"
                        data-attr={`edit-prop-${name}`}
                        title={`Edit ${name}`}
                    >
                        <EditOutlined />
                    </Button>
                </div>
            )}
        </div>
    )
}
