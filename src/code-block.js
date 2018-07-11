import {registerEnterEditHandler, registerBackspaceHandler} from './keyboard-handlers';

import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import ModelPosition from '@ckeditor/ckeditor5-engine/src/model/position';
import ModelRange from '@ckeditor/ckeditor5-engine/src/model/range';
import ViewPosition from '@ckeditor/ckeditor5-engine/src/view/position';

export default class CodeBlockPlugin extends Plugin {
	static get pluginName() {
		return 'CodeBlock';
	}

	/**
	 * @inheritDoc
	 */
	init() {
		const editor = this.editor;
		const schema = editor.model.schema;
		const conversion = editor.conversion;

		// Insert newlines manually when pressing enter
		// within the code block
		registerEnterEditHandler(this, editor);

		// Remove the codeblock on backspace when the codeblock
		// is empty.
		registerBackspaceHandler(this, editor);

		// Escape from the code block when

		// Configure schema.
		schema.register('codeblock', {
			isObject: true,
			isBlock: true,
			allowContentOf: '$block',
			allowWhere: '$block',
			allowAttributes: ['language']
		});

		conversion.for( 'upcast' )
			.add(viewCodeBlockToModel());

		conversion
			.for('editingDowncast')
			.add(modelCodeBlockToView());

		conversion
			.for('dataDowncast')
			.add(modelCodeBlockToView());
	}
}

export function modelCodeBlockToView() {
	return dispatcher => {
		dispatcher.on( 'insert:codeblock', converter, { priority: 'high' } );
	};

	function converter( evt, data, conversionApi ) {
		// We require the codeblock to have a single text node.
		if ( data.item.childCount === 0 ) {
			return;
		}

		const codeBlock = data.item;

		// Consume the codeblock and text
		conversionApi.consumable.consume( codeBlock, 'insert' );

		// Wrap the element in a <pre> <code> block
		const viewWriter = conversionApi.writer;
		const preElement = viewWriter.createContainerElement( 'pre', { class: 'language-TODO' } );
		const codeElement = viewWriter.createContainerElement( 'code' );

		viewWriter.insert( ViewPosition.createAt( preElement ), codeElement );

		conversionApi.mapper.bindElements( codeBlock, codeElement );

		// Insert at matching position
		const insertPosition = conversionApi.mapper.toViewPosition( data.range.start );
		viewWriter.insert( insertPosition, preElement );

		evt.stop();
	}
}

export function viewCodeBlockToModel() {
	return dispatcher => {
		dispatcher.on( 'element:pre', converter, { priority: 'high' } );
	};

	function converter( evt, data, conversionApi ) {
		// Do not convert if this is not an "image figure".
		if ( !conversionApi.consumable.test( data.viewItem, { name: true } ) ) {
			return;
		}

		// Find an code element inside the pre element.
		const codeBlock = Array.from( data.viewItem.getChildren() ).find( viewChild => viewChild.is( 'code' ) );

		// Do not convert if code block is absent
		if ( !codeBlock || !conversionApi.consumable.consume( codeBlock, { name: true } ) ) {
			return;
		}

		// Create the model element
		const modelCodeBlock = conversionApi.writer.createElement( 'codeblock' );

		// Find allowed parent for paragraph that we are going to insert. If current parent does not allow
		// to insert paragraph but one of the ancestors does then split nodes to allowed parent.
		const splitResult = conversionApi.splitToAllowedParent( modelCodeBlock, data.modelCursor );

		// When there is no split result it means that we can't insert paragraph in this position.
		if ( splitResult ) {
			// Insert codeblock in allowed position.
			conversionApi.writer.insert( modelCodeBlock, splitResult.position );

			// Convert text child of codeblock
			const { modelRange } = conversionApi.convertChildren( codeBlock, ModelPosition.createAt( modelCodeBlock ) );

			// Set as conversion result, attribute converters may use this property.
			data.modelRange = new ModelRange( ModelPosition.createBefore( modelCodeBlock ), modelRange.end );

			// Convert after pre element
			data.modelCursor = data.modelRange.end;
		}
	}
}
