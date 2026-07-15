import { PromptAssembler, parseElmResponse } from '../src';

describe('ELM327 parser', () => {
  it('removes echo, normalizes data and detects prompt', () => {
    expect(parseElmResponse('010D\r7E8 03 41 0D 28\r>', '010D')).toMatchObject({ complete: true, dataLines: ['7E803410D28'], statuses: [] });
  });
  it('preserves adapter statuses without treating them as data', () => {
    expect(parseElmResponse('SEARCHING...\rNO DATA\r>')).toMatchObject({ statuses: ['NO DATA'], dataLines: [] });
  });
  it('assembles fragmented and coalesced notifications', () => {
    const assembler = new PromptAssembler();
    expect(assembler.push(new TextEncoder().encode('41 0D'))).toEqual([]);
    expect(assembler.push(new TextEncoder().encode(' 28\r>OK\r>'))).toEqual(['41 0D 28\r>', 'OK\r>']);
  });
});
